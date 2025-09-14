import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, execute, get } = deployments;

  const { deployer, admin } = await getNamedAccounts();

  console.log("Deploying VaultManager with deployer:", deployer);

  // Get dependencies
  const stablecoin = await get("Stablecoin");
  const guardedOracle = await get("GuardedOracle");

  // Deploy VaultManager
  const vaultManager = await deploy("VaultManager", {
    from: deployer,
    args: [
      stablecoin.address, // stablecoin token
      guardedOracle.address, // oracle for price feeds
      admin, // admin role
    ],
    log: true,
    deterministic: true,
  });

  console.log(`VaultManager deployed at: ${vaultManager.address}`);

  // Grant VaultManager the MINTER_ROLE on Stablecoin  
  const minterRole = await deployments.read("Stablecoin", "MINTER_ROLE");
  const burnerRole = await deployments.read("Stablecoin", "BURNER_ROLE");
  
  await execute(
    "Stablecoin",
    { from: admin, log: true },
    "grantRole",
    minterRole,
    vaultManager.address
  );

  await execute(
    "Stablecoin",
    { from: admin, log: true },
    "grantRole",
    burnerRole,
    vaultManager.address
  );

  console.log(`Granted MINTER_ROLE and BURNER_ROLE to VaultManager`);

  // Set up collateral configurations
  const erc4626Adapter = await get("ERC4626Adapter");
  const rebasingAdapter = await get("RebasingAdapter");

  // Add ERC4626 collateral (wstETH via vault)
  await execute(
    "VaultManager",
    { from: admin, log: true },
    "setCollateral",
    "0x7374455448000000000000000000000000000000000000000000000000000000", // keccak256("stETH")
    erc4626Adapter.address,
    8000, // 80% LTV
    true  // enabled
  );

  // Add rebasing collateral (direct wstETH)  
  await execute(
    "VaultManager",
    { from: admin, log: true },
    "setCollateral",
    "0x7773744554480000000000000000000000000000000000000000000000000000", // keccak256("wstETH")
    rebasingAdapter.address,
    7500, // 75% LTV
    true  // enabled
  );

  console.log("VaultManager configured with collateral types");
};

func.tags = ["VaultManager", "Core"];
func.dependencies = ["Adapters", "StabilityPool"];
func.id = "deploy_vault_manager";

export default func;