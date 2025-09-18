import "@nomicfoundation/hardhat-viem";
import "@nomicfoundation/hardhat-mocha";
import "hardhat-deploy";
// import "hardhat-gas-reporter"; // Removed for Hardhat v3 compatibility
// import "solidity-coverage"; // Removed for Hardhat v3 compatibility

import { HardhatUserConfig } from "hardhat/config";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: { 
      optimizer: { enabled: true, runs: 200 } 
    },
  },
  networks: {
    hardhat: { 
      type: "edr-simulated" 
    },
    localhost: {
      type: "http",
      url: "http://127.0.0.1:8545",
    },
    sepolia: {
      type: "http", 
      url: process.env.SEPOLIA_RPC_URL || "https://sepolia.infura.io/v3/YOUR-PROJECT-ID",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  namedAccounts: {
    deployer: {
      default: 0,
      sepolia: process.env.DEPLOYER_ADDRESS || 0,
    },
    admin: {
      default: 1,
      sepolia: process.env.ADMIN_ADDRESS || 1,
    },
    treasury: {
      default: 2,
      sepolia: process.env.TREASURY_ADDRESS || 2,
    },
    liquidator: {
      default: 3,
      sepolia: process.env.LIQUIDATOR_ADDRESS || 3,
    },
  },
  // gasReporter: { // Removed for Hardhat v3 compatibility
  //   enabled: process.env.REPORT_GAS ? true : false,
  //   currency: "USD",
  //   gasPrice: 20,
  // },
};

export default config;
