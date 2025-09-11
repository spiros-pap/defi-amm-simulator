// Simple working example that bypasses hardhat test runner issues
import { createTestClient, http, parseEther } from "viem";
import { hardhat } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

async function testViem() {
  console.log("🧪 Testing Viem Integration");
  
  // Create test client with public actions
  const testClient = createTestClient({
    chain: hardhat,
    mode: 'hardhat',
    transport: http(),
  }).extend((client) => ({
    async getChainId() {
      return client.request({ method: 'eth_chainId' }).then((id: string) => parseInt(id, 16));
    },
    async getBalance(params: { address: string }) {
      return client.request({ method: 'eth_getBalance', params: [params.address, 'latest'] })
        .then((balance: string) => BigInt(balance));
    }
  }));
  
  // Test wallet with known private key (hardhat account #0)
  const account = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
  
  const walletClient = createTestClient({
    chain: hardhat,
    mode: 'hardhat',
    transport: http(),
    account,
  }).extend((client) => ({
    async sendTransaction(params: any) {
      return client.request({ method: 'eth_sendTransaction', params: [params] });
    }
  }));
  
  try {
    // Test 1: Check chain connection
    const chainId = await testClient.getChainId();
    console.log("✅ Chain ID:", chainId);
    
    // Test 2: Check account balance
    const balance = await testClient.getBalance({
      address: account.address,
    });
    console.log("✅ Account address:", account.address);
    console.log("✅ Balance:", balance.toString(), "wei");
    
    // Test 3: Send transaction
    const recipient = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const hash = await walletClient.sendTransaction({
      to: recipient,
      value: parseEther("1"),
    });
    console.log("✅ Transaction sent:", hash);
    
    console.log("\n🎉 All tests passed! Viem is working correctly.");
    
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testViem();
}

export { testViem };