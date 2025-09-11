import hre from "hardhat";

async function main() {
  console.log("Testing hre.viem availability...");
  
  if (hre.viem) {
    console.log("✅ hre.viem is available!");
    
    try {
      const [admin, user] = await hre.viem.getWalletClients();
      console.log("✅ getWalletClients() works!");
      console.log("Admin address:", admin.account.address);
      console.log("User address:", user.account.address);
      
      const publicClient = await hre.viem.getPublicClient();
      const chainId = await publicClient.getChainId();
      console.log("✅ Chain ID:", chainId);
      
    } catch (error) {
      console.error("❌ Error using hre.viem:", error);
    }
  } else {
    console.error("❌ hre.viem is not available");
    console.log("Available hre properties:", Object.keys(hre));
  }
}

main().catch(console.error);