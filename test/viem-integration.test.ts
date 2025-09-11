import { expect } from "chai";
import hre from "hardhat";

describe("Viem Integration Test", () => {
  it("should have access to hre.viem and getWalletClients", async () => {
    // Verify hre.viem exists
    expect(hre.viem).to.not.be.undefined;
    
    // Get wallet clients
    const [admin, user] = await hre.viem.getWalletClients();
    
    // Verify we got valid wallet clients
    expect(admin).to.not.be.undefined;
    expect(user).to.not.be.undefined;
    expect(admin.account.address).to.match(/^0x[0-9a-fA-F]{40}$/);
    expect(user.account.address).to.match(/^0x[0-9a-fA-F]{40}$/);
    
    console.log("Admin address:", admin.account.address);
    console.log("User address:", user.account.address);
  });

  it("should be able to get a public client", async () => {
    const publicClient = await hre.viem.getPublicClient();
    expect(publicClient).to.not.be.undefined;
    
    // Get chain ID to verify client is working
    const chainId = await publicClient.getChainId();
    expect(chainId).to.equal(31337); // Default Hardhat chain ID
    
    console.log("Chain ID:", chainId);
  });
});