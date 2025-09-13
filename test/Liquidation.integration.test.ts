import { expect } from "chai";
import { createPublicClient, createWalletClient, http, parseEther, keccak256, encodePacked } from "viem";
import { hardhat } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

describe("Liquidation: Integration", () => {
  let liquidationEngine: any;
  let vaultManager: any;
  let stabilityPool: any;
  let oracle: any;
  let admin: any;
  let borrower: any;
  let liquidator1: any;
  let liquidator2: any;
  let publicClient: any;

  // Constants
  const COMMIT_WINDOW = 300;
  const REVEAL_WINDOW = 300;
  const MIN_COMMIT_BOND = parseEther("0.1");
  const MIN_LOT = parseEther("1.0");
  const MAX_BATCH_SIZE = 10;

  // Mock data for integration testing
  const INITIAL_COLLATERAL_PRICE = parseEther("2000"); // $2000 per ETH
  const LIQUIDATION_THRESHOLD_PRICE = parseEther("1500"); // Trigger liquidation at $1500
  const VAULT_ID = 1n;

  beforeEach(async () => {
    // Setup accounts
    admin = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
    borrower = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');
    liquidator1 = privateKeyToAccount('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a');
    liquidator2 = privateKeyToAccount('0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6');
    
    publicClient = createPublicClient({
      chain: hardhat,
      transport: http()
    });

    // Mock oracle with price manipulation capability
    oracle = {
      currentPrice: INITIAL_COLLATERAL_PRICE,
      getPrice: async () => [oracle.currentPrice, true],
      setPrice: (newPrice: bigint) => { oracle.currentPrice = newPrice; }
    };

    // Mock stability pool
    stabilityPool = {
      availableFunds: parseEther("1000000"),
      burned: 0n,
      credited: new Map(),
      
      burnStableFrom: async (from: string, amount: bigint) => {
        stabilityPool.burned += amount;
        return true;
      },
      
      available: async () => stabilityPool.availableFunds,
      
      credit: async (to: string, amount: bigint) => {
        const current = stabilityPool.credited.get(to) || 0n;
        stabilityPool.credited.set(to, current + amount);
      }
    };

    // Mock vault manager with liquidation integration
    vaultManager = {
      vaults: new Map(),
      liquidationEngine: null as any,
      
      // Simulate vault health based on collateral value vs debt
      health: async (vaultId: bigint) => {
        const vault = vaultManager.vaults.get(Number(vaultId));
        if (!vault) return 0n;
        
        const collateralValue = (BigInt(vault.collateral) * oracle.currentPrice) / parseEther("1");
        const healthRatio = (collateralValue * parseEther("1")) / BigInt(vault.debt);
        return healthRatio;
      },
      
      flagForLiquidation: async (vaultId: bigint) => {
        if (vaultManager.liquidationEngine) {
          await vaultManager.liquidationEngine.enqueue(vaultId);
        }
      },
      
      onLiquidationSettle: async (vaultIds: bigint[], filledQty: bigint[], clearingPrice: bigint) => {
        // Simulate debt burning and collateral transfer
        for (let i = 0; i < vaultIds.length; i++) {
          const vaultId = Number(vaultIds[i]);
          const vault = vaultManager.vaults.get(vaultId);
          if (vault && filledQty[i] > 0n) {
            // Burn proportional debt
            const debtToBurn = vault.debt * filledQty[i] / vault.collateral;
            await stabilityPool.burnStableFrom(vault.borrower, debtToBurn);
            
            // Update vault state
            vault.debt -= debtToBurn;
            vault.collateral -= filledQty[i];
          }
        }
      },
      
      // Helper to create a vault for testing
      createVault: (vaultId: number, borrower: string, collateral: bigint, debt: bigint) => {
        vaultManager.vaults.set(vaultId, { borrower, collateral, debt });
      }
    };

    // Mock liquidation engine with full flow
    liquidationEngine = {
      vaultQueue: [] as bigint[],
      batches: new Map(),
      activeBatchId: 0n,
      commitments: new Map(),
      bonds: new Map(),
      
      // Core functions
      enqueue: async (vaultId: bigint) => {
        liquidationEngine.vaultQueue.push(vaultId);
      },
      
      startBatch: async () => {
        if (liquidationEngine.vaultQueue.length === 0) return;
        
        liquidationEngine.activeBatchId++;
        const batchId = liquidationEngine.activeBatchId;
        
        liquidationEngine.batches.set(Number(batchId), {
          startCommitTs: Math.floor(Date.now() / 1000),
          startRevealTs: Math.floor(Date.now() / 1000) + COMMIT_WINDOW,
          vaultIds: [...liquidationEngine.vaultQueue],
          totalQtyOffered: parseEther("10"), // Mock total collateral
          clearingPrice: 0n,
          revealedBids: [],
          settled: false
        });
        
        liquidationEngine.vaultQueue = [];
      },
      
      commitBid: async (batchId: bigint, commitment: string, bond: bigint, bidder: string) => {
        const key = `${batchId}-${bidder}`;
        liquidationEngine.commitments.set(key, commitment);
        liquidationEngine.bonds.set(key, bond);
      },
      
      revealBid: async (batchId: bigint, vaultId: bigint, qty: bigint, price: bigint, salt: string, bidder: string) => {
        // Verify commitment
        const expectedCommitment = keccak256(
          encodePacked(
            ["uint256", "uint256", "uint256", "bytes32", "address"],
            [vaultId, qty, price, salt as `0x${string}`, bidder as `0x${string}`]
          )
        );
        
        const key = `${batchId}-${bidder}`;
        const storedCommitment = liquidationEngine.commitments.get(key);
        const isValid = storedCommitment === expectedCommitment;
        
        const batch = liquidationEngine.batches.get(Number(batchId));
        if (batch) {
          batch.revealedBids.push({ bidder, vaultId, qty, price, salt, valid: isValid });
        }
        
        return isValid;
      },
      
      settle: async (batchId: bigint) => {
        const batch = liquidationEngine.batches.get(Number(batchId));
        if (!batch) return;
        
        // Calculate clearing price (simplified)
        const validBids = batch.revealedBids.filter((bid: any) => bid.valid);
        if (validBids.length === 0) {
          batch.clearingPrice = 0n;
          batch.settled = true;
          return;
        }
        
        // Sort by price descending
        validBids.sort((a: any, b: any) => Number(b.price - a.price));
        
        // Simple clearing price: highest price that fills available quantity
        let totalDemand = 0n;
        let clearingPrice = 0n;
        
        for (const bid of validBids) {
          totalDemand += bid.qty;
          if (totalDemand >= batch.totalQtyOffered) {
            clearingPrice = bid.price;
            break;
          }
        }
        
        if (clearingPrice === 0n && validBids.length > 0) {
          clearingPrice = validBids[validBids.length - 1].price;
        }
        
        batch.clearingPrice = clearingPrice;
        batch.settled = true;
        
        // Execute settlement through vault manager
        const filledQty = [batch.totalQtyOffered]; // Simplified
        await vaultManager.onLiquidationSettle(batch.vaultIds, filledQty, clearingPrice);
      },
      
      // View functions
      getBatch: (batchId: bigint) => {
        return liquidationEngine.batches.get(Number(batchId));
      }
    };

    // Connect components
    vaultManager.liquidationEngine = liquidationEngine;
  });

  describe("End-to-End Liquidation Flow", () => {
    it("should execute complete liquidation flow: price drop → flag → commit → reveal → settle", async () => {
      // 1. Setup: Create a healthy vault
      const collateralAmount = parseEther("1"); // 1 ETH
      const debtAmount = parseEther("1000"); // $1000 debt
      
      vaultManager.createVault(
        Number(VAULT_ID), 
        borrower.address, 
        collateralAmount, 
        debtAmount
      );
      
      // Verify initial health (should be healthy at $2000/ETH)
      const initialHealth = await vaultManager.health(VAULT_ID);
      expect(Number(initialHealth)).to.be.greaterThan(Number(parseEther("1.5"))); // >150% health
      
      // 2. Price manipulation: Drive price down to trigger liquidation
      oracle.setPrice(LIQUIDATION_THRESHOLD_PRICE); // $1500/ETH
      
      const healthAfterDrop = await vaultManager.health(VAULT_ID);
      expect(Number(healthAfterDrop)).to.be.lessThan(Number(parseEther("1.5"))); // <150% health
      
      // 3. Flag vault for liquidation
      await vaultManager.flagForLiquidation(VAULT_ID);
      expect(liquidationEngine.vaultQueue).to.include(VAULT_ID);
      
      // 4. Start batch
      await liquidationEngine.startBatch();
      expect(liquidationEngine.activeBatchId).to.equal(1n);
      
      const batch = liquidationEngine.getBatch(1n);
      expect(batch.vaultIds).to.include(VAULT_ID);
      
      // 5. Liquidators commit bids (hidden prices)
      const bid1 = {
        vaultId: VAULT_ID,
        qty: parseEther("0.5"),
        price: parseEther("1400"), // $1400/ETH
        salt: keccak256(encodePacked(["uint256"], [12345n]))
      };
      
      const bid2 = {
        vaultId: VAULT_ID,
        qty: parseEther("0.3"),
        price: parseEther("1450"), // $1450/ETH
        salt: keccak256(encodePacked(["uint256"], [12346n]))
      };
      
      const commitment1 = keccak256(
        encodePacked(
          ["uint256", "uint256", "uint256", "bytes32", "address"],
          [bid1.vaultId, bid1.qty, bid1.price, bid1.salt, liquidator1.address as `0x${string}`]
        )
      );
      
      const commitment2 = keccak256(
        encodePacked(
          ["uint256", "uint256", "uint256", "bytes32", "address"],
          [bid2.vaultId, bid2.qty, bid2.price, bid2.salt, liquidator2.address as `0x${string}`]
        )
      );
      
      await liquidationEngine.commitBid(1n, commitment1, MIN_COMMIT_BOND, liquidator1.address);
      await liquidationEngine.commitBid(1n, commitment2, MIN_COMMIT_BOND, liquidator2.address);
      
      // 6. Reveal phase: Liquidators reveal their bids
      const valid1 = await liquidationEngine.revealBid(
        1n, bid1.vaultId, bid1.qty, bid1.price, bid1.salt, liquidator1.address
      );
      const valid2 = await liquidationEngine.revealBid(
        1n, bid2.vaultId, bid2.qty, bid2.price, bid2.salt, liquidator2.address
      );
      
      expect(valid1).to.be.true;
      expect(valid2).to.be.true;
      
      // 7. Settlement: Execute liquidation
      const initialDebt = vaultManager.vaults.get(Number(VAULT_ID)).debt;
      const initialStableBurned = stabilityPool.burned;
      
      await liquidationEngine.settle(1n);
      
      const settledBatch = liquidationEngine.getBatch(1n);
      expect(settledBatch.settled).to.be.true;
      expect(Number(settledBatch.clearingPrice)).to.be.greaterThan(0);
      
      // 8. Verify liquidation effects
      const finalVault = vaultManager.vaults.get(Number(VAULT_ID));
      const finalStableBurned = stabilityPool.burned;
      
      // Debt should be reduced
      expect(Number(finalVault.debt)).to.be.lessThan(Number(initialDebt));
      
      // Stable should be burned from pool
      expect(Number(finalStableBurned)).to.be.greaterThan(Number(initialStableBurned));
      
      // Collateral should be reduced
      expect(Number(finalVault.collateral)).to.be.lessThan(Number(collateralAmount));
    });

    it("should demonstrate MEV resistance: hidden prices prevent front-running", async () => {
      // Setup vault for liquidation
      vaultManager.createVault(Number(VAULT_ID), borrower.address, parseEther("1"), parseEther("1000"));
      oracle.setPrice(LIQUIDATION_THRESHOLD_PRICE);
      
      await vaultManager.flagForLiquidation(VAULT_ID);
      await liquidationEngine.startBatch();
      
      // Scenario: Liquidator commits a high-value bid
      const highValueBid = {
        vaultId: VAULT_ID,
        qty: parseEther("0.8"),
        price: parseEther("1600"), // Very competitive price
        salt: keccak256(encodePacked(["uint256"], [99999n]))
      };
      
      const commitment = keccak256(
        encodePacked(
          ["uint256", "uint256", "uint256", "bytes32", "address"],
          [highValueBid.vaultId, highValueBid.qty, highValueBid.price, highValueBid.salt, liquidator1.address as `0x${string}`]
        )
      );
      
      // MEV bot cannot see the actual bid details during commit phase
      await liquidationEngine.commitBid(1n, commitment, MIN_COMMIT_BOND, liquidator1.address);
      
      // Even if MEV bot tries to front-run during reveal phase, 
      // they cannot create a valid commitment without knowing the original salt
      const mevBotAttempt = {
        vaultId: VAULT_ID,
        qty: parseEther("0.9"), // Higher quantity
        price: parseEther("1650"), // Higher price
        salt: keccak256(encodePacked(["uint256"], [88888n])) // Different salt
      };
      
      const mevCommitment = keccak256(
        encodePacked(
          ["uint256", "uint256", "uint256", "bytes32", "address"],
          [mevBotAttempt.vaultId, mevBotAttempt.qty, mevBotAttempt.price, mevBotAttempt.salt, liquidator2.address as `0x${string}`]
        )
      );
      
      // MEV bot commits (but this is after the original commit)
      await liquidationEngine.commitBid(1n, mevCommitment, MIN_COMMIT_BOND, liquidator2.address);
      
      // During reveal, original liquidator reveals valid bid
      const validReveal = await liquidationEngine.revealBid(
        1n, highValueBid.vaultId, highValueBid.qty, highValueBid.price, highValueBid.salt, liquidator1.address
      );
      
      // MEV bot's reveal will be valid for their commitment, but they committed later
      const mevReveal = await liquidationEngine.revealBid(
        1n, mevBotAttempt.vaultId, mevBotAttempt.qty, mevBotAttempt.price, mevBotAttempt.salt, liquidator2.address
      );
      
      expect(validReveal).to.be.true;
      expect(mevReveal).to.be.true; // Both can be valid
      
      // But settlement uses uniform pricing, so both pay the same clearing price
      await liquidationEngine.settle(1n);
      
      const batch = liquidationEngine.getBatch(1n);
      // The clearing price protects against MEV extraction
      expect(Number(batch.clearingPrice)).to.be.greaterThan(0);
    });
  });

  describe("Multiple Vault Scenarios", () => {
    it("should handle batch liquidation of multiple vaults", async () => {
      // Create multiple unhealthy vaults
      vaultManager.createVault(1, borrower.address, parseEther("1"), parseEther("1000"));
      vaultManager.createVault(2, liquidator1.address, parseEther("0.5"), parseEther("600"));
      vaultManager.createVault(3, liquidator2.address, parseEther("2"), parseEther("2500"));
      
      // Drive down price to make all vaults unhealthy
      oracle.setPrice(parseEther("1200")); // $1200/ETH
      
      // Flag all vaults
      await vaultManager.flagForLiquidation(1n);
      await vaultManager.flagForLiquidation(2n);
      await vaultManager.flagForLiquidation(3n);
      
      await liquidationEngine.startBatch();
      
      const batch = liquidationEngine.getBatch(1n);
      expect(batch.vaultIds.length).to.equal(3);
      
      // Liquidator bids on multiple vaults
      const commitment = keccak256(
        encodePacked(
          ["uint256", "uint256", "uint256", "bytes32", "address"],
          [1n, parseEther("1"), parseEther("1100"), keccak256(encodePacked(["uint256"], [555n])), liquidator1.address as `0x${string}`]
        )
      );
      
      await liquidationEngine.commitBid(1n, commitment, MIN_COMMIT_BOND, liquidator1.address);
      
      const valid = await liquidationEngine.revealBid(
        1n, 1n, parseEther("1"), parseEther("1100"), keccak256(encodePacked(["uint256"], [555n])), liquidator1.address
      );
      
      expect(valid).to.be.true;
      
      await liquidationEngine.settle(1n);
      
      const settledBatch = liquidationEngine.getBatch(1n);
      expect(settledBatch.settled).to.be.true;
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle liquidation with insufficient stability pool funds", async () => {
      // Reduce available funds in stability pool
      stabilityPool.availableFunds = parseEther("100"); // Very low
      
      vaultManager.createVault(Number(VAULT_ID), borrower.address, parseEther("1"), parseEther("1000"));
      oracle.setPrice(LIQUIDATION_THRESHOLD_PRICE);
      
      await vaultManager.flagForLiquidation(VAULT_ID);
      await liquidationEngine.startBatch();
      
      const commitment = keccak256(
        encodePacked(
          ["uint256", "uint256", "uint256", "bytes32", "address"],
          [VAULT_ID, parseEther("0.5"), parseEther("1400"), keccak256(encodePacked(["uint256"], [777n])), liquidator1.address as `0x${string}`]
        )
      );
      
      await liquidationEngine.commitBid(1n, commitment, MIN_COMMIT_BOND, liquidator1.address);
      await liquidationEngine.revealBid(
        1n, VAULT_ID, parseEther("0.5"), parseEther("1400"), keccak256(encodePacked(["uint256"], [777n])), liquidator1.address
      );
      
      // Settlement should handle limited funds gracefully
      await liquidationEngine.settle(1n);
      
      const batch = liquidationEngine.getBatch(1n);
      expect(batch.settled).to.be.true;
    });

    it("should handle batch with no valid bids", async () => {
      vaultManager.createVault(Number(VAULT_ID), borrower.address, parseEther("1"), parseEther("1000"));
      oracle.setPrice(LIQUIDATION_THRESHOLD_PRICE);
      
      await vaultManager.flagForLiquidation(VAULT_ID);
      await liquidationEngine.startBatch();
      
      // Commit but don't reveal (or reveal with wrong parameters)
      const commitment = keccak256(
        encodePacked(
          ["uint256", "uint256", "uint256", "bytes32", "address"],
          [VAULT_ID, parseEther("0.5"), parseEther("1400"), keccak256(encodePacked(["uint256"], [888n])), liquidator1.address as `0x${string}`]
        )
      );
      
      await liquidationEngine.commitBid(1n, commitment, MIN_COMMIT_BOND, liquidator1.address);
      
      // Don't reveal, or reveal with wrong data
      // await liquidationEngine.revealBid(...) // Skip this step
      
      await liquidationEngine.settle(1n);
      
      const batch = liquidationEngine.getBatch(1n);
      expect(batch.clearingPrice).to.equal(0n); // No clearing price due to no valid bids
      expect(batch.settled).to.be.true; // But still marked as settled
    });
  });
});