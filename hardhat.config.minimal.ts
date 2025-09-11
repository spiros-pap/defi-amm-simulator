import "@nomicfoundation/hardhat-mocha";
import "@nomicfoundation/hardhat-viem";

import { HardhatUserConfig } from "hardhat/config";

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    hardhat: { type: "edr-simulated" },
  },
};

export default config;