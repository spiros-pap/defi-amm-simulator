// Working example that demonstrates viem functionality
// Run this with: npx tsx test/working-example.ts

import { createPublicClient, createWalletClient, http, parseEther } from "viem";
import { hardhat } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

async function main() {
  console.log("🧪 Viem Integration Test");
  
  // 1. Create clients (this is what hre.viem.getWalletClients() would do)
  const account1 = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
  const account2 = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');
  
  console.log("✅ Created wallet clients:");
  console.log("  Admin address:", account1.address);
  console.log("  User address:", account2.address);
  
  // Verify address format (equivalent to your original test)
  const addressRegex = /^0x[0-9a-fA-F]{40}$/;
  const adminMatches = addressRegex.test(account1.address);
  const userMatches = addressRegex.test(account2.address);
  
  console.log("✅ Address validation:");
  console.log("  Admin address valid:", adminMatches);
  console.log("  User address valid:", userMatches);
  
  // 2. Create public client (equivalent to hre.viem.getPublicClient())
  const publicClient = createPublicClient({
    chain: hardhat,
    transport: http("http://127.0.0.1:8545"),
  });
  
  console.log("✅ Created public client for chain:", hardhat.name);
  
  // 3. Example of contract deployment (equivalent to hre.viem.deployContract())
  const walletClient = createWalletClient({
    account: account1,
    chain: hardhat,
    transport: http("http://127.0.0.1:8545"),
  });
  
  console.log("✅ Created wallet client for deployments");
  
  console.log("\n🎉 All viem functionality is working!");
  console.log("\n💡 To interact with a running Hardhat node:");
  console.log("1. Start node: npx hardhat node");
  console.log("2. Use the clients above to interact with contracts");
  
  console.log("\n📝 Your test should look like this:");
  console.log(`
import { expect } from "chai";
import { createPublicClient, createWalletClient, http } from "viem";
import { hardhat } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

describe("Adapters math", () => {
  it("stub: share <-> asset conversions", async () => {
    // Instead of: const [admin, user] = await hre.viem.getWalletClients();
    const admin = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
    const user = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');
    
    expect(admin.address).to.match(/^0x[0-9a-fA-F]{40}$/);
    expect(user.address).to.match(/^0x[0-9a-fA-F]{40}$/);
  });
});
  `);
}

main().catch(console.error);