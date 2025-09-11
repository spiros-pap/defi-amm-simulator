import "@nomicfoundation/hardhat-viem";
import "@nomicfoundation/hardhat-mocha";

import { HardhatUserConfig } from "hardhat/config";

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
  },
};

export default config;
