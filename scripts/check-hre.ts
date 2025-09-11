import hre from "hardhat";
console.log("hre keys:", Object.keys(hre).sort());
console.log("viem present?", "viem" in hre);
