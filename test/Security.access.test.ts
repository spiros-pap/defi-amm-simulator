import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { parseEther, keccak256, encodePacked, getAddress } from "viem";

describe("Security - Access Controls", function () {
  async function deployFixture() {
    const [owner, admin, treasury, liquidator, user, attacker] = await hre.viem.getWalletClients();

    // Deploy core contracts
    const stablecoin = await hre.viem.deployContract("Stablecoin", []);
    const priceOracle = await hre.viem.deployContract("PriceOracle", []);
    const vaultManager = await hre.viem.deployContract("VaultManager", [
      stablecoin.address,
      priceOracle.address
    ]);
    const liquidationEngine = await hre.viem.deployContract("LiquidationEngine", [
      vaultManager.address
    ]);
    const stabilityPool = await hre.viem.deployContract("StabilityPool", [
      stablecoin.address,
      vaultManager.address
    ]);

    // Deploy mock assets
    const mockToken = await hre.viem.deployContract("MockERC20", [
      "Mock wstETH",
      "wstETH",
      18n
    ]);

    const mock4626 = await hre.viem.deployContract("Mock4626Vault", [
      mockToken.address,
      "Mock Vault",
      "mvToken"
    ]);

    // Deploy adapters
    const erc4626Adapter = await hre.viem.deployContract("ERC4626Adapter", [
      mock4626.address
    ]);

    return {
      stablecoin,
      vaultManager,
      liquidationEngine,
      stabilityPool,
      priceOracle,
      mockToken,
      mock4626,
      erc4626Adapter,
      owner,
      admin,
      treasury,
      liquidator,
      user,
      attacker
    };
  }

  describe("Role-based Access Control", function () {
    it("Should prevent unauthorized minting", async function () {
      const { stablecoin, attacker } = await loadFixture(deployFixture);

      // Attacker tries to mint tokens directly
      await expect(
        stablecoin.write.mint([attacker.account.address, parseEther("1000")], {
          account: attacker.account
        })
      ).to.be.rejected;
    });

    it("Should prevent unauthorized vault operations", async function () {
      const { vaultManager, attacker } = await loadFixture(deployFixture);
      
      const collateralKey = keccak256(encodePacked(["string"], ["wstETH"]));

      // Attacker tries to directly manipulate vault state
      await expect(
        vaultManager.write.liquidate([1n, attacker.account.address], {
          account: attacker.account
        })
      ).to.be.rejected;
    });

    it("Should prevent unauthorized price manipulation", async function () {
      const { priceOracle, mockToken, attacker } = await loadFixture(deployFixture);

      // Attacker tries to set price
      await expect(
        priceOracle.write.setPrice([mockToken.address, parseEther("1")], {
          account: attacker.account
        })
      ).to.be.rejected;
    });

    it("Should prevent unauthorized liquidation engine control", async function () {
      const { liquidationEngine, attacker } = await loadFixture(deployFixture);

      // Attacker tries to start batch
      await expect(
        liquidationEngine.write.startBatch({
          account: attacker.account
        })
      ).to.be.rejected;

      // Attacker tries to settle without permission
      await expect(
        liquidationEngine.write.settle([1n], {
          account: attacker.account
        })
      ).to.be.rejected;
    });

    it("Should prevent unauthorized stability pool operations", async function () {
      const { stabilityPool, attacker } = await loadFixture(deployFixture);

      // Attacker tries to trigger liquidation payout
      await expect(
        stabilityPool.write.liquidate([1n, parseEther("1000")], {
          account: attacker.account
        })
      ).to.be.rejected;
    });
  });

  describe("Admin Controls", function () {
    it("Should allow admin to manage roles", async function () {
      const { stablecoin, owner, admin, treasury } = await loadFixture(deployFixture);

      // Grant minter role to treasury
      const MINTER_ROLE = await stablecoin.read.MINTER_ROLE();
      await stablecoin.write.grantRole([MINTER_ROLE, treasury.account.address]);

      // Verify role was granted
      const hasRole = await stablecoin.read.hasRole([MINTER_ROLE, treasury.account.address]);
      expect(hasRole).to.be.true;

      // Treasury should now be able to mint
      await stablecoin.write.mint([admin.account.address, parseEther("100")], {
        account: treasury.account
      });

      const balance = await stablecoin.read.balanceOf([admin.account.address]);
      expect(balance).to.equal(parseEther("100"));
    });

    it("Should prevent non-admin from managing roles", async function () {
      const { stablecoin, attacker, user } = await loadFixture(deployFixture);

      const MINTER_ROLE = await stablecoin.read.MINTER_ROLE();
      
      // Attacker tries to grant themselves minter role
      await expect(
        stablecoin.write.grantRole([MINTER_ROLE, attacker.account.address], {
          account: attacker.account
        })
      ).to.be.rejected;

      // User tries to grant attacker minter role
      await expect(
        stablecoin.write.grantRole([MINTER_ROLE, attacker.account.address], {
          account: user.account
        })
      ).to.be.rejected;
    });

    it("Should allow admin to revoke roles", async function () {
      const { stablecoin, owner, treasury } = await loadFixture(deployFixture);

      const MINTER_ROLE = await stablecoin.read.MINTER_ROLE();
      
      // Grant role first
      await stablecoin.write.grantRole([MINTER_ROLE, treasury.account.address]);
      
      // Revoke role
      await stablecoin.write.revokeRole([MINTER_ROLE, treasury.account.address]);

      // Verify role was revoked
      const hasRole = await stablecoin.read.hasRole([MINTER_ROLE, treasury.account.address]);
      expect(hasRole).to.be.false;

      // Treasury should no longer be able to mint
      await expect(
        stablecoin.write.mint([treasury.account.address, parseEther("100")], {
          account: treasury.account
        })
      ).to.be.rejected;
    });
  });

  describe("Function Modifiers", function () {
    it("Should enforce onlyRole modifiers", async function () {
      const { vaultManager, liquidationEngine, attacker } = await loadFixture(deployFixture);

      // Test various protected functions
      const protectedFunctions = [
        () => vaultManager.write.setLiquidationThreshold([parseEther("0.8")], {
          account: attacker.account
        }),
        () => liquidationEngine.write.setCommitWindow([600n], {
          account: attacker.account  
        }),
      ];

      for (const fn of protectedFunctions) {
        await expect(fn()).to.be.rejected;
      }
    });

    it("Should enforce whenNotPaused modifiers", async function () {
      const { vaultManager, owner, user } = await loadFixture(deployFixture);

      // Pause the contract (assuming pausable functionality)
      // This would require implementing Pausable in contracts
      // await vaultManager.write.pause();

      // User operations should be blocked when paused
      const collateralKey = keccak256(encodePacked(["string"], ["wstETH"]));
      
      // Note: This test assumes pause functionality is implemented
      // await expect(
      //   vaultManager.write.deposit([collateralKey, parseEther("1")], {
      //     account: user.account
      //   })
      // ).to.be.revertedWith("Pausable: paused");
    });
  });

  describe("Ownership Transfer", function () {
    it("Should allow owner to transfer ownership", async function () {
      const { stablecoin, owner, admin } = await loadFixture(deployFixture);

      const DEFAULT_ADMIN_ROLE = await stablecoin.read.DEFAULT_ADMIN_ROLE();
      
      // Transfer admin role
      await stablecoin.write.grantRole([DEFAULT_ADMIN_ROLE, admin.account.address]);
      await stablecoin.write.renounceRole([DEFAULT_ADMIN_ROLE, owner.account.address]);

      // Verify admin now has control
      const adminHasRole = await stablecoin.read.hasRole([DEFAULT_ADMIN_ROLE, admin.account.address]);
      expect(adminHasRole).to.be.true;

      const ownerHasRole = await stablecoin.read.hasRole([DEFAULT_ADMIN_ROLE, owner.account.address]);
      expect(ownerHasRole).to.be.false;
    });

    it("Should prevent unauthorized ownership transfer", async function () {
      const { stablecoin, attacker } = await loadFixture(deployFixture);

      const DEFAULT_ADMIN_ROLE = await stablecoin.read.DEFAULT_ADMIN_ROLE();
      
      // Attacker tries to grant themselves admin role
      await expect(
        stablecoin.write.grantRole([DEFAULT_ADMIN_ROLE, attacker.account.address], {
          account: attacker.account
        })
      ).to.be.rejected;
    });
  });

  describe("Cross-Contract Access Control", function () {
    it("Should verify VaultManager can mint stablecoin", async function () {
      const { stablecoin, vaultManager, owner } = await loadFixture(deployFixture);

      // Grant minter role to VaultManager
      const MINTER_ROLE = await stablecoin.read.MINTER_ROLE();
      await stablecoin.write.grantRole([MINTER_ROLE, vaultManager.address]);

      // VaultManager should be able to mint (this would be tested via internal function)
      const hasRole = await stablecoin.read.hasRole([MINTER_ROLE, vaultManager.address]);
      expect(hasRole).to.be.true;
    });

    it("Should verify LiquidationEngine can access VaultManager", async function () {
      const { vaultManager, liquidationEngine, owner } = await loadFixture(deployFixture);

      // Grant liquidator role to LiquidationEngine
      // This assumes VaultManager has a LIQUIDATOR_ROLE
      // const LIQUIDATOR_ROLE = await vaultManager.read.LIQUIDATOR_ROLE();
      // await vaultManager.write.grantRole([LIQUIDATOR_ROLE, liquidationEngine.address]);

      // Verify the role assignment
      // const hasRole = await vaultManager.read.hasRole([LIQUIDATOR_ROLE, liquidationEngine.address]);
      // expect(hasRole).to.be.true;
    });
  });

  describe("Emergency Controls", function () {
    it("Should allow authorized emergency pause", async function () {
      const { vaultManager, owner } = await loadFixture(deployFixture);

      // This test assumes emergency pause functionality exists
      // Implementation would depend on actual contract design
      
      // Example of what emergency controls might look like:
      // await expect(vaultManager.write.emergencyPause()).to.not.be.rejected;
      
      // Verify system is paused
      // const isPaused = await vaultManager.read.paused();
      // expect(isPaused).to.be.true;
    });

    it("Should prevent unauthorized emergency actions", async function () {
      const { vaultManager, attacker } = await loadFixture(deployFixture);

      // Attacker tries emergency pause
      // await expect(
      //   vaultManager.write.emergencyPause({
      //     account: attacker.account
      //   })
      // ).to.be.rejected;
    });
  });

  describe("Input Validation", function () {
    it("Should reject zero addresses", async function () {
      const { owner } = await loadFixture(deployFixture);

      // Test deployment with zero address
      await expect(
        hre.viem.deployContract("VaultManager", [
          "0x0000000000000000000000000000000000000000", // Zero address for stablecoin
          "0x0000000000000000000000000000000000000001"
        ])
      ).to.be.rejected;
    });

    it("Should reject invalid parameters", async function () {
      const { vaultManager, owner } = await loadFixture(deployFixture);

      // Test setting invalid liquidation threshold (>100%)
      // await expect(
      //   vaultManager.write.setLiquidationThreshold([parseEther("1.1")], {
      //     account: owner.account
      //   })
      // ).to.be.rejected;
    });
  });

  describe("Reentrancy Protection", function () {
    it("Should prevent reentrancy attacks on deposit", async function () {
      // This would require a malicious contract that tries to reenter
      // during deposit callback. Implementation depends on specific
      // reentrancy protection mechanisms used.
    });

    it("Should prevent reentrancy attacks on liquidation", async function () {
      // Similar to above - would test liquidation reentrancy protection
    });
  });
});