// Try importing the plugin directly to see if it exposes viem functionality
import "@nomicfoundation/hardhat-viem";
import hre from "hardhat";

async function main() {
  console.log("Attempting to import viem functionality directly...");
  
  try {
    // Try to import viem directly and create clients manually
    const { createTestClient, http, parseEther } = await import("viem");
    const { hardhat } = await import("viem/chains");
    
    console.log("✅ Viem imported successfully");
    
    const client = createTestClient({
      chain: hardhat,
      mode: 'hardhat',
      transport: http(),
    });
    
    console.log("✅ Test client created successfully");
    console.log("Chain ID:", hardhat.id);
    
  } catch (error) {
    console.error("❌ Error with viem:", error);
  }
}

main().catch(console.error);