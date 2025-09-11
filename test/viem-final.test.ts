import { expect } from "chai";
import { createPublicClient, createWalletClient, http, parseEther } from "viem";
import { hardhat } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

describe("Viem Integration Test", function() {
  this.timeout(30000);
  
  let publicClient: any;
  let walletClient: any;
  let account: any;

  before(async () => {
    // Create viem clients directly (bypassing hre.viem)
    publicClient = createPublicClient({
      chain: hardhat,
      transport: http("http://127.0.0.1:8545"),
    });

    account = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
    
    walletClient = createWalletClient({
      account,
      chain: hardhat,
      transport: http("http://127.0.0.1:8545"),
    });
  });

  it("should create viem clients successfully", () => {
    expect(publicClient).to.not.be.undefined;
    expect(walletClient).to.not.be.undefined;
    expect(account.address).to.match(/^0x[0-9a-fA-F]{40}$/);
    console.log("✅ Account address:", account.address);
  });

  it("should have correct chain configuration", () => {
    expect(hardhat.id).to.equal(31337);
    expect(hardhat.name).to.equal("Hardhat");
    console.log("✅ Chain ID:", hardhat.id);
  });

  // Note: The following tests require `npx hardhat node` to be running
  it.skip("should get chain ID from running node", async () => {
    const chainId = await publicClient.getChainId();
    expect(chainId).to.equal(31337);
  });

  it.skip("should get account balance from running node", async () => {
    const balance = await publicClient.getBalance({
      address: account.address,
    });
    expect(balance).to.be.greaterThan(0n);
    console.log("✅ Balance:", balance.toString());
  });
});