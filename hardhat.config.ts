import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox-mocha-ethers';
import * as dotenv from 'dotenv';
dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    hardhat: { type: 'edr-simulated' },
    localhost: { type: 'http', url: 'http://127.0.0.1:8545' },
    // Add Sepolia only if env is present
    ...(process.env.SEPOLIA_RPC_URL
      ? {
          sepolia: {
            type: 'http',
            url: process.env.SEPOLIA_RPC_URL as string,
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
          },
        }
      : {}),
  },
  mocha: { timeout: 120000 },
};

export default config;
