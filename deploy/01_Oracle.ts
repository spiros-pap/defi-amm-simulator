import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, execute } = deployments;

  const { deployer, admin } = await getNamedAccounts();

  console.log("Deploying Oracle system with deployer:", deployer);

  // Deploy PriceOracle first
  const priceOracle = await deploy("PriceOracle", {
    from: deployer,
    args: [admin], // admin for updating prices
    log: true,
    deterministic: true,
  });

  // Deploy GuardedOracle with PriceOracle as source
  const guardedOracle = await deploy("GuardedOracle", {
    from: deployer,
    args: [
      priceOracle.address, // source oracle
      300, // maxStaleTime (5 minutes)
      5000, // maxPriceDeviationBps (50%)
      admin, // admin role
    ],
    log: true,
    deterministic: true,
  });

  console.log(`PriceOracle deployed at: ${priceOracle.address}`);
  console.log(`GuardedOracle deployed at: ${guardedOracle.address}`);

  // Set initial prices for common assets (mock data for testing)
  const assets = [
    { 
      name: "ETH",
      address: "0x0000000000000000000000000000000000000001", // Mock ETH address
      price: "2000000000000000000000", // $2000 in 18 decimals
    },
    {
      name: "WSTETH", 
      address: "0x0000000000000000000000000000000000000002", // Mock wstETH address
      price: "2200000000000000000000", // $2200 in 18 decimals
    },
  ];

  for (const asset of assets) {
    await execute(
      "PriceOracle",
      { from: admin, log: true },
      "setPrice",
      asset.address,
      asset.price
    );
    
    console.log(`Set ${asset.name} price to $${parseInt(asset.price) / 1e18}`);
  }

  // Configure sanity bounds on GuardedOracle
  await execute(
    "GuardedOracle", 
    { from: admin, log: true },
    "setSanityBounds",
    "1000000000000000000000", // $1000 min
    "5000000000000000000000"  // $5000 max
  );

  console.log("Oracle system configured with initial prices and sanity bounds");
};

func.tags = ["Oracle", "Core"];
func.dependencies = ["Stablecoin"];
func.id = "deploy_oracle";

export default func;