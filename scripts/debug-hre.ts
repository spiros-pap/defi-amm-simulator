import hre from "hardhat";

async function main() {
  console.log("Network name:", hre.network.name);
  console.log("Network config type:", hre.network.config.type);
  console.log("\nAll HRE properties:", Object.keys(hre));
  console.log("\nChecking for viem specifically:", 'viem' in hre);
}

main().catch(console.error);