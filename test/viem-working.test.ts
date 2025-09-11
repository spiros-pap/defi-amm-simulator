import { expect } from "chai";
import { createTestClient, http, parseEther, getContract } from "viem";
import { hardhat } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

describe("Viem Integration (Working)", () => {
  let testClient: any;
  let walletClient: any;
  
  before(async () => {
    // Create test client manually since hre.viem isn't working
    testClient = createTestClient({
      chain: hardhat,
      mode: 'hardhat',
      transport: http(),
    });
    
    // Create wallet client with a test account
    const account = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
    walletClient = createTestClient({
      chain: hardhat,
      mode: 'hardhat',
      transport: http(),
      account,
    });
  });

  it("should connect to hardhat network", async () => {
    const chainId = await testClient.getChainId();
    expect(chainId).to.equal(31337);
    console.log("✅ Connected to chain:", chainId);
  });
  
  it("should have access to test accounts", async () => {
    const balance = await testClient.getBalance({
      address: walletClient.account.address,
    });
    
    expect(balance).to.be.greaterThan(0n);
    console.log("✅ Account balance:", balance.toString());
    console.log("✅ Account address:", walletClient.account.address);
  });

  it("should be able to send transactions", async () => {
    const recipient = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const amount = parseEther("1");
    
    const hash = await walletClient.sendTransaction({
      to: recipient,
      value: amount,
    });
    
    expect(hash).to.match(/^0x[0-9a-fA-F]{64}$/);
    console.log("✅ Transaction hash:", hash);
  });
});