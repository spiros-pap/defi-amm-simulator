import hre from "hardhat";
import { parseEther, formatEther, keccak256, encodePacked } from "viem";
import { privateKeyToAccount } from "viem/accounts";

async function main() {
  console.log("🚀 Starting Liquidation Simulation");
  console.log("==================================");

  // Deploy all contracts using hardhat-deploy
  console.log("1. Deploying all contracts...");
  await hre.deployments.fixture(["Core"]);
  
  const deployments = await hre.deployments.all();
  console.log("✅ All contracts deployed");
  
  // Get contract instances
  const stablecoin = await hre.viem.getContractAt("Stablecoin", deployments.Stablecoin.address);
  const vaultManager = await hre.viem.getContractAt("VaultManager", deployments.VaultManager.address);
  const liquidationEngine = await hre.viem.getContractAt("LiquidationEngine", deployments.LiquidationEngine.address);
  const priceOracle = await hre.viem.getContractAt("PriceOracle", deployments.PriceOracle.address);
  const erc4626Adapter = await hre.viem.getContractAt("ERC4626Adapter", deployments.ERC4626Adapter.address);
  const mockWSTETH = await hre.viem.getContractAt("MockERC20", deployments.MockERC20.address);
  const stabilityPool = await hre.viem.getContractAt("StabilityPool", deployments.StabilityPool.address);

  // Setup accounts
  const [deployer, user, liquidator1, liquidator2] = await hre.viem.getWalletClients();
  
  console.log("📋 Contract Addresses:");
  console.log(`  Stablecoin: ${stablecoin.address}`);
  console.log(`  VaultManager: ${vaultManager.address}`);
  console.log(`  LiquidationEngine: ${liquidationEngine.address}`);
  console.log(`  PriceOracle: ${priceOracle.address}`);

  console.log("\n2. Setting up initial state...");
  
  // Mint some wstETH to user for testing
  await mockWSTETH.write.mint([user.account.address, parseEther("10")]);
  console.log(`✅ Minted 10 wstETH to user: ${user.account.address}`);

  // User approves VaultManager to spend wstETH
  await mockWSTETH.write.approve([vaultManager.address, parseEther("10")], {
    account: user.account,
  });

  console.log("\n3. Depositing collateral and borrowing...");
  
  // User deposits 5 ETH worth of wstETH via 4626 adapter
  const collateralKey = keccak256(encodePacked(["string"], ["wstETH"]));
  
  await vaultManager.write.deposit([collateralKey, parseEther("5")], {
    account: user.account,
  });
  
  console.log("✅ Deposited 5 wstETH as collateral");

  // User borrows 6000 stablecoin (should be safe at $2200/ETH)
  await vaultManager.write.borrow([collateralKey, parseEther("6000")], {
    account: user.account,
  });
  
  const userBalance = await stablecoin.read.balanceOf([user.account.address]);
  console.log(`✅ Borrowed ${formatEther(userBalance)} stablecoin`);

  // Check vault health
  const healthBefore = await vaultManager.read.xhealth([user.account.address, collateralKey]);
  console.log(`📊 Initial vault health: ${formatEther(healthBefore[0])} collateral value, ${formatEther(healthBefore[1])} debt`);
  console.log(`   Healthy: ${healthBefore[3]}`);

  console.log("\n4. Manipulating price to trigger liquidation...");
  
  // Drop wstETH price from $2200 to $1400 (below liquidation threshold)
  const newPrice = parseEther("1400");
  await priceOracle.write.setPrice([mockWSTETH.address, newPrice]);
  
  console.log(`💥 Price dropped to $${formatEther(newPrice)}`);

  // Check health after price drop
  const healthAfter = await vaultManager.read.health([user.account.address, collateralKey]);
  console.log(`📊 Vault health after price drop:`);
  console.log(`   Collateral value: $${formatEther(healthAfter[0])}`);
  console.log(`   Debt: $${formatEther(healthAfter[1])}`);
  console.log(`   Healthy: ${healthAfter[3]}`);

  if (!healthAfter[3]) {
    console.log("🚨 Vault is now underwater! Proceeding with liquidation...");
  }

  console.log("\n5. Starting liquidation batch...");
  
  // Flag vault for liquidation (simplified - using vault ID 1)
  const vaultId = 1n;
  await vaultManager.write.flagForLiquidation([vaultId]);
  console.log(`🏃 Flagged vault ${vaultId} for liquidation`);

  // Start liquidation batch
  await liquidationEngine.write.startBatch();
  const batchId = await liquidationEngine.read.activeBatchId();
  console.log(`📦 Started liquidation batch ${batchId}`);

  // Get batch info
  const batchInfo = await liquidationEngine.read.getBatch([batchId]);
  console.log(`📋 Batch info:`);
  console.log(`   Commit window ends: ${new Date(Number(batchInfo[1]) * 1000).toISOString()}`);
  console.log(`   Total collateral available: ${formatEther(batchInfo[3])} ETH`);

  console.log("\n6. Liquidators submitting bids...");
  
  // Liquidator 1 commits bid
  const bid1 = {
    vaultId: vaultId,
    qty: parseEther("2.5"), // 2.5 ETH
    price: parseEther("1350"), // $1350/ETH
    salt: keccak256(encodePacked(["uint256"], [12345n])),
  };

  const commitment1 = keccak256(
    encodePacked(
      ["uint256", "uint256", "uint256", "bytes32", "address"],
      [bid1.vaultId, bid1.qty, bid1.price, bid1.salt, liquidator1.account.address]
    )
  );

  await liquidationEngine.write.commitBid([batchId, commitment1], {
    value: parseEther("0.1"), // Bond
    account: liquidator1.account,
  });

  console.log(`✅ Liquidator 1 committed bid: ${formatEther(bid1.qty)} ETH @ $${formatEther(bid1.price)}`);

  // Liquidator 2 commits bid
  const bid2 = {
    vaultId: vaultId,
    qty: parseEther("3.0"), // 3.0 ETH
    price: parseEther("1320"), // $1320/ETH
    salt: keccak256(encodePacked(["uint256"], [67890n])),
  };

  const commitment2 = keccak256(
    encodePacked(
      ["uint256", "uint256", "uint256", "bytes32", "address"],
      [bid2.vaultId, bid2.qty, bid2.price, bid2.salt, liquidator2.account.address]
    )
  );

  await liquidationEngine.write.commitBid([batchId, commitment2], {
    value: parseEther("0.1"), // Bond
    account: liquidator2.account,
  });

  console.log(`✅ Liquidator 2 committed bid: ${formatEther(bid2.qty)} ETH @ $${formatEther(bid2.price)}`);

  console.log("\n7. Moving to reveal phase...");
  
  // Fast forward time to reveal phase
  await hre.network.provider.send("evm_increaseTime", [300]); // 5 minutes
  await hre.network.provider.send("evm_mine");

  console.log("⏰ Advanced to reveal phase");

  // Liquidators reveal bids
  await liquidationEngine.write.revealBid([
    batchId,
    bid1.vaultId,
    bid1.qty,
    bid1.price,
    bid1.salt
  ], {
    account: liquidator1.account,
  });

  console.log("✅ Liquidator 1 revealed bid");

  await liquidationEngine.write.revealBid([
    batchId,
    bid2.vaultId,
    bid2.qty,
    bid2.price,
    bid2.salt
  ], {
    account: liquidator2.account,
  });

  console.log("✅ Liquidator 2 revealed bid");

  console.log("\n8. Settlement phase...");
  
  // Move to settlement phase
  await hre.network.provider.send("evm_increaseTime", [300]); // Another 5 minutes
  await hre.network.provider.send("evm_mine");

  console.log("⏰ Advanced to settlement phase");

  // Settle the batch
  await liquidationEngine.write.settle([batchId]);

  // Get final batch info
  const finalBatchInfo = await liquidationEngine.read.getBatch([batchId]);
  console.log(`📋 Settlement results:`);
  console.log(`   Clearing price: $${formatEther(finalBatchInfo[4])}`);
  console.log(`   Total filled: ${formatEther(finalBatchInfo[3])} ETH`);
  console.log(`   Settled: ${finalBatchInfo[5]}`);

  console.log("\n9. Final balances and state...");
  
  // Check final vault health
  const finalHealth = await vaultManager.read.health([user.account.address, collateralKey]);
  console.log(`📊 Final vault health:`);
  console.log(`   Collateral value: $${formatEther(finalHealth[0])}`);
  console.log(`   Debt: $${formatEther(finalHealth[1])}`);
  console.log(`   Healthy: ${finalHealth[3]}`);

  console.log("\n🎉 Liquidation simulation completed!");
  console.log("=====================================");
  console.log("Summary:");
  console.log("- Vault became undercollateralized due to price drop");
  console.log("- Two liquidators participated in commit-reveal auction");
  console.log("- Uniform clearing price was determined");
  console.log("- Collateral was distributed to winning bidders");
  console.log("- Vault debt was reduced proportionally");
}

// Execute simulation
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Simulation failed:", error);
    process.exit(1);
  });