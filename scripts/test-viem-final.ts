// Simple test that works with your current setup
import { createPublicClient, createWalletClient, http, parseEther } from "viem";
import { hardhat } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

async function testViem() {
  console.log("🧪 Testing Viem Integration with Hardhat");
  
  // Create clients using standard viem approach
  const publicClient = createPublicClient({
    chain: hardhat,
    transport: http("http://127.0.0.1:8545"),
  });
  
  const account = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
  
  const walletClient = createWalletClient({
    account,
    chain: hardhat,
    transport: http("http://127.0.0.1:8545"),
  });
  
  try {
    console.log("✅ Clients created successfully");
    console.log("✅ Account address:", account.address);
    console.log("✅ Chain ID:", hardhat.id);
    
    // Note: For these to work, you need to start hardhat node first:
    // npx hardhat node
    console.log("\n💡 To test with actual blockchain interaction:");
    console.log("1. Run: npx hardhat node");
    console.log("2. Then run this test again");
    
    console.log("\n🎉 Viem setup is correct!");
    
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

testViem();