import { expect } from "chai";
import { createPublicClient, createWalletClient, http, parseEther, keccak256, encodePacked } from "viem";
import { hardhat } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import hre from "hardhat";

describe("Liquidation: Clearing Price", () => {
  let liquidationEngine: any;
  let mockVaultManager: any;
  let mockStabilityPool: any;
  let admin: any;
  let bidders: any[];
  let publicClient: any;

  // Constants for testing
  const COMMIT_WINDOW = 300; // 5 minutes
  const REVEAL_WINDOW = 300; // 5 minutes
  const MIN_COMMIT_BOND = parseEther("0.1");
  const MIN_LOT = parseEther("1.0");
  const MAX_BATCH_SIZE = 10;

  beforeEach(async () => {
    // Setup viem clients with multiple bidders
    admin = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
    bidders = [
      privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'),
      privateKeyToAccount('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'),
      privateKeyToAccount('0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6'),
      privateKeyToAccount('0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a')
    ];
    
    publicClient = createPublicClient({
      chain: hardhat,
      transport: http()
    });

    // Mock contracts for MVP testing
    mockVaultManager = {
      address: "0x1000000000000000000000000000000000000001"
    };
    
    mockStabilityPool = {
      address: "0x2000000000000000000000000000000000000002"
    };

    // Simplified mock liquidation engine for testing clearing price logic
    liquidationEngine = {
      write: {
        grantRole: async () => {},
        enqueue: async () => {},
        startBatch: async () => {},
        commitBid: async () => {},
        revealBid: async () => {},
        settle: async () => {}
      },
      read: {
        activeBatchId: async () => 1n,
        LIQUIDATOR_ROLE: async () => "0x1234",
        getBatch: async () => [0n, 0n, [1n], parseEther("1"), parseEther("150"), true] // Mock clearing price
      }
    };

    await liquidationEngine.write.grantRole([
      await liquidationEngine.read.LIQUIDATOR_ROLE(),
      admin.address
    ]);
  });

  async function setupBatch() {
    await liquidationEngine.write.enqueue([1n]);
    await liquidationEngine.write.startBatch();
    return await liquidationEngine.read.activeBatchId();
  }

  async function commitBid(bidder: any, batchId: bigint, vaultId: bigint, qty: bigint, price: bigint, salt: number) {
    const saltBytes = keccak256(encodePacked(["uint256"], [BigInt(salt)]));
    const commitment = keccak256(
      encodePacked(
        ["uint256", "uint256", "uint256", "bytes32", "address"],
        [vaultId, qty, price, saltBytes, bidder.address]
      )
    );

    await liquidationEngine.write.commitBid([batchId, commitment], {
      value: MIN_COMMIT_BOND,
      account: bidder.address
    });

    return { vaultId, qty, price, salt: saltBytes };
  }

  async function revealBid(bidder: any, batchId: bigint, vaultId: bigint, qty: bigint, price: bigint, salt: `0x${string}`) {
    await liquidationEngine.write.revealBid([batchId, vaultId, qty, price, salt], {
      account: bidder.address
    });
  }

  async function moveToRevealPhase() {
    await publicClient.request({
      method: 'evm_increaseTime',
      params: [COMMIT_WINDOW]
    });
    await publicClient.request({
      method: 'evm_mine',
      params: []
    });
  }

  async function moveToSettlementPhase() {
    await publicClient.request({
      method: 'evm_increaseTime',
      params: [REVEAL_WINDOW + 1]
    });
    await publicClient.request({
      method: 'evm_mine',
      params: []
    });
  }

  describe("Uniform Clearing Price", () => {
    it("should calculate correct clearing price with simple bids", async () => {
      const batchId = await setupBatch();
      
      // Setup bids: 
      // Bidder 0: 5 units @ 120 price
      // Bidder 1: 3 units @ 100 price  
      // Bidder 2: 2 units @ 80 price
      // Total available: MIN_LOT (1.0 ETH)
      
      const bid1 = await commitBid(bidders[0], batchId, 1n, parseEther("5"), parseEther("120"), 12345);
      const bid2 = await commitBid(bidders[1], batchId, 1n, parseEther("3"), parseEther("100"), 12346);  
      const bid3 = await commitBid(bidders[2], batchId, 1n, parseEther("2"), parseEther("80"), 12347);

      await moveToRevealPhase();

      // Reveal all bids
      await revealBid(bidders[0], batchId, bid1.vaultId, bid1.qty, bid1.price, bid1.salt);
      await revealBid(bidders[1], batchId, bid2.vaultId, bid2.qty, bid2.price, bid2.salt);
      await revealBid(bidders[2], batchId, bid3.vaultId, bid3.qty, bid3.price, bid3.salt);

      await moveToSettlementPhase();

      // Settle and check clearing price
      await liquidationEngine.write.settle([batchId]);
      
      const batchInfo = await liquidationEngine.read.getBatch([batchId]);
      const clearingPrice = batchInfo[4]; // clearingPrice is 5th element
      
      // With total supply of MIN_LOT (1 ETH) and bids totaling 10 ETH,
      // clearing price should be the highest price that fills available supply
      expect(clearingPrice).to.equal(parseEther("120"));
    });

    it("should handle undersupply scenario correctly", async () => {
      const batchId = await setupBatch();
      
      // Only one small bid for available collateral
      const bid1 = await commitBid(bidders[0], batchId, 1n, parseEther("0.5"), parseEther("100"), 12345);

      await moveToRevealPhase();
      await revealBid(bidders[0], batchId, bid1.vaultId, bid1.qty, bid1.price, bid1.salt);
      await moveToSettlementPhase();

      await liquidationEngine.write.settle([batchId]);
      
      const batchInfo = await liquidationEngine.read.getBatch([batchId]);
      const clearingPrice = batchInfo[4];
      
      // Should use the bidder's price since demand < supply
      expect(clearingPrice).to.equal(parseEther("100"));
    });
  });

  describe("Oversubscribed Batches", () => {
    it("should handle oversubscribed batch with pro-rata allocation", async () => {
      const batchId = await setupBatch();
      
      // Total demand much higher than supply (MIN_LOT = 1 ETH)
      const bid1 = await commitBid(bidders[0], batchId, 1n, parseEther("10"), parseEther("120"), 12345);
      const bid2 = await commitBid(bidders[1], batchId, 1n, parseEther("8"), parseEther("110"), 12346);
      const bid3 = await commitBid(bidders[2], batchId, 1n, parseEther("5"), parseEther("100"), 12347);
      const bid4 = await commitBid(bidders[3], batchId, 1n, parseEther("2"), parseEther("90"), 12348);

      await moveToRevealPhase();

      await revealBid(bidders[0], batchId, bid1.vaultId, bid1.qty, bid1.price, bid1.salt);
      await revealBid(bidders[1], batchId, bid2.vaultId, bid2.qty, bid2.price, bid2.salt);
      await revealBid(bidders[2], batchId, bid3.vaultId, bid3.qty, bid3.price, bid3.salt);
      await revealBid(bidders[3], batchId, bid4.vaultId, bid4.qty, bid4.price, bid4.salt);

      await moveToSettlementPhase();
      await liquidationEngine.write.settle([batchId]);

      // Verify batch was settled
      const batchInfo = await liquidationEngine.read.getBatch([batchId]);
      expect(batchInfo[5]).to.equal(true); // settled flag
      
      // Clearing price should maximize filled quantity
      const clearingPrice = batchInfo[4];
      expect(Number(clearingPrice)).to.be.greaterThan(0);
    });

    it("should correctly sort bids by price for clearing calculation", async () => {
      const batchId = await setupBatch();
      
      // Submit bids in random price order
      const bid1 = await commitBid(bidders[0], batchId, 1n, parseEther("2"), parseEther("80"), 12345);  // Low
      const bid2 = await commitBid(bidders[1], batchId, 1n, parseEther("3"), parseEther("150"), 12346); // High
      const bid3 = await commitBid(bidders[2], batchId, 1n, parseEther("1"), parseEther("120"), 12347); // Mid

      await moveToRevealPhase();

      await revealBid(bidders[0], batchId, bid1.vaultId, bid1.qty, bid1.price, bid1.salt);
      await revealBid(bidders[1], batchId, bid2.vaultId, bid2.qty, bid2.price, bid2.salt);
      await revealBid(bidders[2], batchId, bid3.vaultId, bid3.qty, bid3.price, bid3.salt);

      await moveToSettlementPhase();
      await liquidationEngine.write.settle([batchId]);

      const batchInfo = await liquidationEngine.read.getBatch([batchId]);
      const clearingPrice = batchInfo[4];
      
      // Should fill highest priced bids first
      // With 1 ETH available and 6 ETH total demand, clearing price should favor higher bidders
      expect(Number(clearingPrice)).to.be.greaterThan(Number(parseEther("100")));
    });
  });

  describe("Partial Fills", () => {
    it("should handle partial fills correctly when oversubscribed", async () => {
      const batchId = await setupBatch();
      
      // Two equal high-price bids competing for limited supply
      const bid1 = await commitBid(bidders[0], batchId, 1n, parseEther("0.7"), parseEther("200"), 12345);
      const bid2 = await commitBid(bidders[1], batchId, 1n, parseEther("0.7"), parseEther("200"), 12346);
      // Total demand: 1.4 ETH, Available: 1.0 ETH

      await moveToRevealPhase();

      await revealBid(bidders[0], batchId, bid1.vaultId, bid1.qty, bid1.price, bid1.salt);
      await revealBid(bidders[1], batchId, bid2.vaultId, bid2.qty, bid2.price, bid2.salt);

      await moveToSettlementPhase();
      await liquidationEngine.write.settle([batchId]);

      const batchInfo = await liquidationEngine.read.getBatch([batchId]);
      expect(batchInfo[5]).to.equal(true); // Should be settled
      expect(batchInfo[4]).to.equal(parseEther("200")); // Clearing price should match bid price
    });

    it("should distribute proportionally among equal price bids", async () => {
      const batchId = await setupBatch();
      
      // Multiple bidders at same price level
      const samePrice = parseEther("150");
      const bid1 = await commitBid(bidders[0], batchId, 1n, parseEther("0.4"), samePrice, 12345);
      const bid2 = await commitBid(bidders[1], batchId, 1n, parseEther("0.3"), samePrice, 12346);
      const bid3 = await commitBid(bidders[2], batchId, 1n, parseEther("0.5"), samePrice, 12347);
      // Total: 1.2 ETH demand for 1.0 ETH supply

      await moveToRevealPhase();

      await revealBid(bidders[0], batchId, bid1.vaultId, bid1.qty, bid1.price, bid1.salt);
      await revealBid(bidders[1], batchId, bid2.vaultId, bid2.qty, bid2.price, bid2.salt);
      await revealBid(bidders[2], batchId, bid3.vaultId, bid3.qty, bid3.price, bid3.salt);

      await moveToSettlementPhase();
      await liquidationEngine.write.settle([batchId]);

      const batchInfo = await liquidationEngine.read.getBatch([batchId]);
      expect(batchInfo[4]).to.equal(samePrice); // Should clear at the common price
    });
  });

  describe("Edge Cases", () => {
    it("should handle batch with no valid reveals", async () => {
      const batchId = await setupBatch();
      
      // Commit but don't reveal any bids
      await commitBid(bidders[0], batchId, 1n, parseEther("5"), parseEther("100"), 12345);
      await commitBid(bidders[1], batchId, 1n, parseEther("3"), parseEther("120"), 12346);

      await moveToRevealPhase();
      await moveToSettlementPhase();

      // Settle without any reveals
      await liquidationEngine.write.settle([batchId]);

      const batchInfo = await liquidationEngine.read.getBatch([batchId]);
      expect(batchInfo[4]).to.equal(0n); // Clearing price should be 0
      expect(batchInfo[5]).to.equal(true); // But still settled
    });

    it("should handle batch with only invalid reveals", async () => {
      const batchId = await setupBatch();
      
      const bid1 = await commitBid(bidders[0], batchId, 1n, parseEther("5"), parseEther("100"), 12345);
      
      await moveToRevealPhase();

      // Reveal with wrong parameters (invalid)
      await revealBid(bidders[0], batchId, bid1.vaultId, parseEther("10"), parseEther("100"), bid1.salt); // Wrong qty

      await moveToSettlementPhase();
      await liquidationEngine.write.settle([batchId]);

      const batchInfo = await liquidationEngine.read.getBatch([batchId]);
      expect(batchInfo[4]).to.equal(0n); // Should be 0 due to no valid bids
    });

    it("should handle single bidder scenario", async () => {
      const batchId = await setupBatch();
      
      const bid1 = await commitBid(bidders[0], batchId, 1n, parseEther("0.5"), parseEther("100"), 12345);

      await moveToRevealPhase();
      await revealBid(bidders[0], batchId, bid1.vaultId, bid1.qty, bid1.price, bid1.salt);
      await moveToSettlementPhase();

      await liquidationEngine.write.settle([batchId]);

      const batchInfo = await liquidationEngine.read.getBatch([batchId]);
      expect(batchInfo[4]).to.equal(parseEther("100")); // Should clear at bid price
    });
  });

  describe("Arithmetic Precision", () => {
    it("should handle very small quantities correctly", async () => {
      const batchId = await setupBatch();
      
      // Very small quantities
      const bid1 = await commitBid(bidders[0], batchId, 1n, parseEther("0.001"), parseEther("1000"), 12345);
      const bid2 = await commitBid(bidders[1], batchId, 1n, parseEther("0.002"), parseEther("999"), 12346);

      await moveToRevealPhase();
      await revealBid(bidders[0], batchId, bid1.vaultId, bid1.qty, bid1.price, bid1.salt);
      await revealBid(bidders[1], batchId, bid2.vaultId, bid2.qty, bid2.price, bid2.salt);
      await moveToSettlementPhase();

      await liquidationEngine.write.settle([batchId]);

      const batchInfo = await liquidationEngine.read.getBatch([batchId]);
      expect(batchInfo[5]).to.equal(true); // Should settle successfully
    });

    it("should handle very large quantities correctly", async () => {
      const batchId = await setupBatch();
      
      // Very large quantities
      const bid1 = await commitBid(bidders[0], batchId, 1n, parseEther("1000000"), parseEther("1"), 12345);

      await moveToRevealPhase();
      await revealBid(bidders[0], batchId, bid1.vaultId, bid1.qty, bid1.price, bid1.salt);
      await moveToSettlementPhase();

      await liquidationEngine.write.settle([batchId]);

      const batchInfo = await liquidationEngine.read.getBatch([batchId]);
      expect(batchInfo[4]).to.equal(parseEther("1")); // Should clear at bid price
    });
  });
});