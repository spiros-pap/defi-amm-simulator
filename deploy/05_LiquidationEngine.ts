import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, execute, get } = deployments;

  const { deployer, admin, liquidator } = await getNamedAccounts();

  console.log("Deploying LiquidationEngine with deployer:", deployer);

  // Get dependencies
  const vaultManager = await get("VaultManager");
  const stabilityPool = await get("StabilityPool");

  // Deploy LiquidationEngine
  const liquidationEngine = await deploy("LiquidationEngine", {
    from: deployer,
    args: [
      300, // COMMIT_WINDOW (5 minutes)
      300, // REVEAL_WINDOW (5 minutes)  
      "100000000000000000", // minCommitBond (0.1 ETH)
      "1000000000000000000", // minLot (1 ETH)
      10, // maxBatchSize
      vaultManager.address,
      stabilityPool.address,
    ],
    log: true,
    deterministic: true,
  });

  console.log(`LiquidationEngine deployed at: ${liquidationEngine.address}`);

  // Set liquidation engine address in VaultManager
  await execute(
    "VaultManager",
    { from: admin, log: true },
    "setLiquidationEngine",
    liquidationEngine.address
  );

  // Grant roles
  const liquidatorRole = await deployments.read("LiquidationEngine", "LIQUIDATOR_ROLE");
  
  await execute(
    "LiquidationEngine",
    { from: admin, log: true },
    "grantRole",
    liquidatorRole,
    liquidator
  );

  await execute(
    "LiquidationEngine",
    { from: admin, log: true },
    "grantRole",
    liquidatorRole,
    vaultManager.address // VaultManager can flag vaults
  );

  console.log(`Granted LIQUIDATOR_ROLE to liquidator: ${liquidator}`);
  console.log(`Granted LIQUIDATOR_ROLE to VaultManager: ${vaultManager.address}`);

  // Grant StabilityPool permissions to LiquidationEngine if needed
  const stabilityPoolRole = await deployments.read("StabilityPool", "DEFAULT_ADMIN_ROLE");
  
  await execute(
    "StabilityPool",
    { from: admin, log: true },
    "grantRole",
    stabilityPoolRole,
    liquidationEngine.address
  );

  console.log("LiquidationEngine integrated with VaultManager and StabilityPool");
};

func.tags = ["LiquidationEngine", "Core"];
func.dependencies = ["VaultManager"];
func.id = "deploy_liquidation_engine";

export default func;