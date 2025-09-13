import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, execute, get } = deployments;

  const { deployer, admin, treasury } = await getNamedAccounts();

  console.log("Deploying StabilityPool with deployer:", deployer);

  // Get Stablecoin address
  const stablecoin = await get("Stablecoin");

  // Deploy StabilityPool
  const stabilityPool = await deploy("StabilityPool", {
    from: deployer,
    args: [
      stablecoin.address, // stablecoin token
      treasury, // treasury address for fees
      admin, // admin role
    ],
    log: true,
    deterministic: true,
  });

  console.log(`StabilityPool deployed at: ${stabilityPool.address}`);

  // Grant StabilityPool the BURNER_ROLE on Stablecoin
  const burnerRole = await deployments.read("Stablecoin", "BURNER_ROLE");
  
  await execute(
    "Stablecoin",
    { from: admin, log: true },
    "grantRole",
    burnerRole,
    stabilityPool.address
  );

  console.log(`Granted BURNER_ROLE to StabilityPool: ${stabilityPool.address}`);

  // Set initial parameters
  await execute(
    "StabilityPool",
    { from: admin, log: true },
    "setLiquidationReward",
    "500" // 5% liquidation reward
  );

  await execute(
    "StabilityPool", 
    { from: admin, log: true },
    "setMaxDeposit",
    "10000000000000000000000000" // 10M max deposit
  );

  console.log("StabilityPool configured with initial parameters");
};

func.tags = ["StabilityPool", "Core"];
func.dependencies = ["Stablecoin"];
func.id = "deploy_stability_pool";

export default func;