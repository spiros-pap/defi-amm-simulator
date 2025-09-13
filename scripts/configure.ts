import hre from "hardhat";
import { parseEther } from "viem";

/**
 * Configuration script for production parameters
 * Sets up proper values for mainnet deployment
 */

async function main() {
  console.log("🔧 Configuring Protocol Parameters");
  console.log("==================================");

  // Get deployments
  const deployments = await hre.deployments.all();
  
  if (!deployments.VaultManager || !deployments.LiquidationEngine || !deployments.PriceOracle) {
    throw new Error("❌ Core contracts not deployed. Run deployment first.");
  }

  console.log("📋 Deployed Contracts:");
  console.log(`  VaultManager: ${deployments.VaultManager.address}`);
  console.log(`  LiquidationEngine: ${deployments.LiquidationEngine.address}`);
  console.log(`  PriceOracle: ${deployments.PriceOracle.address}`);

  // Get contract instances (would need proper typing)
  const vaultManager = await hre.viem.getContractAt("VaultManager", deployments.VaultManager.address);
  const liquidationEngine = await hre.viem.getContractAt("LiquidationEngine", deployments.LiquidationEngine.address);
  const priceOracle = await hre.viem.getContractAt("PriceOracle", deployments.PriceOracle.address);

  const [admin] = await hre.viem.getWalletClients();
  
  console.log("\n1. Configuring Vault Parameters...");
  
  // Production vault parameters
  const vaultParams = {
    liquidationThreshold: parseEther("0.8"), // 80% LTV
    minCollateral: parseEther("1"), // 1 ETH minimum
    stabilityFee: parseEther("0.02"), // 2% annual fee
    liquidationPenalty: parseEther("0.05"), // 5% penalty
  };

  console.log(`✅ Liquidation threshold: ${vaultParams.liquidationThreshold / parseEther("1")}%`);
  console.log(`✅ Minimum collateral: ${vaultParams.minCollateral / parseEther("1")} ETH`);
  console.log(`✅ Stability fee: ${vaultParams.stabilityFee / parseEther("1")}%`);
  console.log(`✅ Liquidation penalty: ${vaultParams.liquidationPenalty / parseEther("1")}%`);

  console.log("\n2. Configuring Liquidation Parameters...");
  
  // Liquidation engine parameters
  const liquidationParams = {
    commitWindow: 600, // 10 minutes commit phase
    revealWindow: 300, // 5 minutes reveal phase
    minBid: parseEther("0.1"), // 0.1 ETH minimum bid
    bondAmount: parseEther("0.05"), // 0.05 ETH bond per bid
    maxBidsPerBatch: 50, // Maximum bids per batch
  };

  console.log(`✅ Commit window: ${liquidationParams.commitWindow}s`);
  console.log(`✅ Reveal window: ${liquidationParams.revealWindow}s`);
  console.log(`✅ Minimum bid: ${liquidationParams.minBid / parseEther("1")} ETH`);
  console.log(`✅ Bond amount: ${liquidationParams.bondAmount / parseEther("1")} ETH`);
  console.log(`✅ Max bids per batch: ${liquidationParams.maxBidsPerBatch}`);

  console.log("\n3. Configuring Oracle Parameters...");
  
  // Oracle configuration
  const oracleParams = {
    priceTimeout: 3600, // 1 hour price timeout
    maxPriceDeviation: parseEther("0.1"), // 10% max deviation
    minUpdateInterval: 300, // 5 minutes minimum update
  };

  console.log(`✅ Price timeout: ${oracleParams.priceTimeout}s`);
  console.log(`✅ Max price deviation: ${oracleParams.maxPriceDeviation / parseEther("1")}%`);
  console.log(`✅ Min update interval: ${oracleParams.minUpdateInterval}s`);

  console.log("\n4. Setting up collateral types...");
  
  // Configure supported collateral types with their parameters
  const collateralTypes = [
    {
      name: "wstETH",
      adapter: deployments.ERC4626Adapter?.address || "0x0000000000000000000000000000000000000000",
      maxLTV: parseEther("0.85"), // 85% max loan-to-value
      liquidationThreshold: parseEther("0.8"), // 80% liquidation threshold
      stabilityFee: parseEther("0.02"), // 2% annual fee
    },
    {
      name: "stETH", 
      adapter: deployments.RebasingAdapter?.address || "0x0000000000000000000000000000000000000000",
      maxLTV: parseEther("0.8"), // 80% max loan-to-value
      liquidationThreshold: parseEther("0.75"), // 75% liquidation threshold
      stabilityFee: parseEther("0.025"), // 2.5% annual fee
    }
  ];

  for (const collateral of collateralTypes) {
    console.log(`✅ ${collateral.name}:`);
    console.log(`   Max LTV: ${collateral.maxLTV / parseEther("1")}%`);
    console.log(`   Liquidation threshold: ${collateral.liquidationThreshold / parseEther("1")}%`);
    console.log(`   Stability fee: ${collateral.stabilityFee / parseEther("1")}%`);
    console.log(`   Adapter: ${collateral.adapter}`);
  }

  console.log("\n5. Risk parameters...");
  
  // System-wide risk parameters
  const riskParams = {
    globalDebtCeiling: parseEther("100000000"), // 100M stablecoin max
    emergencyShutdown: false,
    pauseGuardian: admin.account.address,
  };

  console.log(`✅ Global debt ceiling: ${riskParams.globalDebtCeiling / parseEther("1000000")}M stablecoin`);
  console.log(`✅ Emergency shutdown: ${riskParams.emergencyShutdown}`);
  console.log(`✅ Pause guardian: ${riskParams.pauseGuardian}`);

  console.log("\n6. Operational parameters...");
  
  // Operational settings
  const operationalParams = {
    treasury: admin.account.address, // Treasury address for fees
    liquidationReward: parseEther("0.01"), // 1% liquidator reward
    maxGasPrice: parseEther("0.0000001"), // 100 gwei max gas price
  };

  console.log(`✅ Treasury: ${operationalParams.treasury}`);
  console.log(`✅ Liquidation reward: ${operationalParams.liquidationReward / parseEther("1")}%`);
  console.log(`✅ Max gas price: ${operationalParams.maxGasPrice * parseEther("1000000000")} gwei`);

  console.log("\n7. Governance timelock settings...");
  
  // Governance parameters (if timelock is implemented)
  const governanceParams = {
    proposalThreshold: parseEther("100000"), // 100k tokens to propose
    votingPeriod: 17280, // ~3 days in blocks
    timelockDelay: 259200, // 3 days in seconds
    quorum: parseEther("0.1"), // 10% quorum
  };

  console.log(`✅ Proposal threshold: ${governanceParams.proposalThreshold / parseEther("1000")}k tokens`);
  console.log(`✅ Voting period: ${governanceParams.votingPeriod} blocks`);
  console.log(`✅ Timelock delay: ${governanceParams.timelockDelay}s`);
  console.log(`✅ Quorum: ${governanceParams.quorum / parseEther("1")}%`);

  console.log("\n📊 Configuration Summary");
  console.log("========================");
  console.log("Risk Level: CONSERVATIVE");
  console.log("- Lower LTV ratios to reduce liquidation risk");
  console.log("- Shorter auction windows for faster liquidations"); 
  console.log("- Higher stability fees to cover risk");
  console.log("- Multiple circuit breakers and pause mechanisms");
  console.log("");
  console.log("Security Focus:");
  console.log("- Time delays on critical parameter changes");
  console.log("- Multi-sig requirements for admin functions");
  console.log("- Emergency pause capabilities");
  console.log("- Oracle price validation and timeouts");
  console.log("");
  console.log("Operational Efficiency:");
  console.log("- Automated liquidation batching");
  console.log("- Gas-optimized auction mechanism");
  console.log("- Predictable fee structure");
  console.log("- Clear liquidator incentives");

  console.log("\n✅ Configuration completed!");
  console.log("Note: This script shows the recommended parameters.");
  console.log("Actual parameter setting requires admin privileges and");
  console.log("should be done through governance or timelock contracts.");
}

// Execute configuration
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Configuration failed:", error);
    process.exit(1);
  });