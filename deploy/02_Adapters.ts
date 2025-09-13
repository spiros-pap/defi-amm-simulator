import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer, admin } = await getNamedAccounts();

  console.log("Deploying Adapters with deployer:", deployer);

  // Deploy MockERC20 tokens for testing
  const mockWSTETH = await deploy("MockERC20", {
    from: deployer,
    args: ["Wrapped Staked ETH", "wstETH", 18],
    log: true,
    deterministic: true,
  });

  const mockUSDC = await deploy("MockERC20", {
    from: deployer,
    args: ["USD Coin", "USDC", 6],
    log: true,
    deterministic: true,
  });

  // Deploy Mock4626Vault for ERC4626 adapter testing
  const mock4626Vault = await deploy("Mock4626Vault", {
    from: deployer,
    args: [
      mockWSTETH.address, // underlying asset
      "Staked ETH Vault", // name
      "sETH", // symbol
    ],
    log: true,
    deterministic: true,
  });

  // Deploy ERC4626Adapter
  const erc4626Adapter = await deploy("ERC4626Adapter", {
    from: deployer,
    args: [
      mock4626Vault.address, // ERC4626 vault
      "Staked ETH Adapter", // name
      admin, // admin role
    ],
    log: true,
    deterministic: true,
  });

  // Deploy RebasingAdapter (using wstETH as example)
  const rebasingAdapter = await deploy("RebasingAdapter", {
    from: deployer,
    args: [
      mockWSTETH.address, // rebasing token
      "wstETH Rebasing Adapter", // name  
      admin, // admin role
    ],
    log: true,
    deterministic: true,
  });

  console.log(`Mock wstETH deployed at: ${mockWSTETH.address}`);
  console.log(`Mock USDC deployed at: ${mockUSDC.address}`);
  console.log(`Mock4626Vault deployed at: ${mock4626Vault.address}`);
  console.log(`ERC4626Adapter deployed at: ${erc4626Adapter.address}`);
  console.log(`RebasingAdapter deployed at: ${rebasingAdapter.address}`);

  // Mint some tokens for testing
  const { execute } = deployments;
  
  const testAmount = "1000000000000000000000"; // 1000 tokens
  
  await execute(
    "MockERC20",
    { from: deployer, log: true },
    "mint",
    deployer,
    testAmount
  );

  console.log("Minted test tokens to deployer for testing");
};

func.tags = ["Adapters", "Core"];
func.dependencies = ["Oracle"];
func.id = "deploy_adapters";

export default func;