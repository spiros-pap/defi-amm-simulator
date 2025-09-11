// Full integration test with live Hardhat node
import { createPublicClient, createWalletClient, http, parseEther } from "viem";
import { hardhat } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

async function fullIntegrationTest() {
  console.log("🚀 Full Viem + Hardhat Integration Test");
  
  try {
    // Create clients
    const publicClient = createPublicClient({
      chain: hardhat,
      transport: http("http://127.0.0.1:8545"),
    });

    const account1 = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
    const account2 = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');
    
    const walletClient = createWalletClient({
      account: account1,
      chain: hardhat,
      transport: http("http://127.0.0.1:8545"),
    });

    // Test 1: Get chain ID
    const chainId = await publicClient.getChainId();
    console.log("✅ Chain ID:", chainId);

    // Test 2: Get balances
    const balance1 = await publicClient.getBalance({ address: account1.address });
    const balance2 = await publicClient.getBalance({ address: account2.address });
    
    console.log("✅ Account 1 balance:", balance1.toString(), "wei");
    console.log("✅ Account 2 balance:", balance2.toString(), "wei");

    // Test 3: Send transaction
    const hash = await walletClient.sendTransaction({
      to: account2.address,
      value: parseEther("1"),
    });
    
    console.log("✅ Transaction sent:", hash);

    // Test 4: Wait for transaction and get receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log("✅ Transaction confirmed in block:", receipt.blockNumber);

    // Test 5: Check updated balances
    const newBalance2 = await publicClient.getBalance({ address: account2.address });
    console.log("✅ Account 2 new balance:", newBalance2.toString(), "wei");

    console.log("\n🎉 ALL TESTS PASSED! Your viem setup is fully functional!");
    
    return {
      success: true,
      chainId,
      transactionHash: hash,
      blockNumber: receipt.blockNumber
    };

  } catch (error) {
    console.error("❌ Test failed:", error);
    return { success: false, error: error.message };
  }
}

fullIntegrationTest();