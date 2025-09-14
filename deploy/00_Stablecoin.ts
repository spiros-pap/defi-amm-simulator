import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, execute } = deployments;

  const { deployer, admin } = await getNamedAccounts();

  console.log("Deploying Stablecoin with deployer:", deployer);

  // Deploy Stablecoin contract
  const stablecoin = await deploy("Stablecoin", {
    from: deployer,
    args: [
      "Yield Stablecoin", // name
      "yUSD", // symbol
      admin, // admin address for minter/burner roles
    ],
    log: true,
    deterministic: true,
  });

  console.log(`Stablecoin deployed at: ${stablecoin.address}`);

  // Grant roles to appropriate addresses
  const minterRole = await deployments.read("Stablecoin", "MINTER_ROLE");
  const burnerRole = await deployments.read("Stablecoin", "BURNER_ROLE");

  // Grant admin the minter and burner roles (they can delegate later)
  await execute(
    "Stablecoin",
    { from: deployer, log: true },
    "grantRole",
    minterRole,
    admin
  );

  await execute(
    "Stablecoin",
    { from: deployer, log: true },
    "grantRole",
    burnerRole,
    admin
  );

  console.log(`Granted MINTER_ROLE and BURNER_ROLE to admin: ${admin}`);
};

func.tags = ["Stablecoin", "Core"];
func.id = "deploy_stablecoin";

export default func;