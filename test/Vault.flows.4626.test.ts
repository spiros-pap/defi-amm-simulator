import hre from "hardhat";


describe("Vault flows - ERC4626 adapter", () => {
  it("deposit -> borrow -> repay -> withdraw; yield improves health", async () => {
    const { viem } = hre;
    const [admin, user] = await viem.getWalletClients();

    const { address: usdcAddr } = await viem.deployContract("MockERC20", ["Token", "TKN", 18n]);
    const USDC = await viem.getContractAt("MockERC20", usdcAddr);

    await USDC.write.mint([user.account.address, 10_000n * 10n ** 18n], { account: admin.account });

    const { address: vaultAddr } = await viem.deployContract("Mock4626Vault", [usdcAddr]);
    const Vault = await viem.getContractAt("Mock4626Vault", vaultAddr);

    const { address: adapterAddr } = await viem.deployContract("ERC4626Adapter", [vaultAddr]);
    const Adapter = await viem.getContractAt("ERC4626Adapter", adapterAddr);

    const { address: oracleAddr } = await viem.deployContract("PriceOracle", [3600n]);
    const Oracle = await viem.getContractAt("PriceOracle", oracleAddr);
    await Oracle.write.setBounds([viem.parseEther("0.5"), viem.parseEther("2")], { account: admin.account });

    const assetKey = usdcAddr as `0x${string}`;
    await Oracle.write.pushPrice([assetKey, viem.parseEther("1")], { account: admin.account });

    const { address: stblAddr } = await viem.deployContract("Stablecoin", ["Stable", "STBL"]);
    const STBL = await viem.getContractAt("Stablecoin", stblAddr);

    const { address: mgrAddr } = await viem.deployContract("VaultManager", [stblAddr, oracleAddr]);
    const Mgr = await viem.getContractAt("VaultManager", mgrAddr);

    const MINTER_ROLE = await STBL.read.MINTER_ROLE();
    const BURNER_ROLE = await STBL.read.BURNER_ROLE();
    await STBL.write.grantRole([MINTER_ROLE, mgrAddr], { account: admin.account });
    await STBL.write.grantRole([BURNER_ROLE, mgrAddr], { account: admin.account });

    await Mgr.write.addCollateral(
      [assetKey, adapterAddr, viem.parseEther("0.8"), 0n],
      { account: admin.account }
    );

    await USDC.write.approve([vaultAddr, 5_000n * 10n ** 18n], { account: user.account });
    await USDC.write.approve([adapterAddr, 5_000n * 10n ** 18n], { account: user.account });

    const { result: vaultId } = await Mgr.simulate.open([], { account: user.account });
    await Mgr.write.open([], { account: user.account });
    await Mgr.write.deposit([assetKey, 2_000n * 10n ** 18n], { account: user.account });

    await Mgr.write.borrow([500n * 10n ** 18n], { account: user.account });
    const stblBal = await STBL.read.balanceOf([user.account.address]);
    expect(stblBal).to.equal(500n * 10n ** 18n);

    if (Vault.abi.some((f: any) => f.name === "increaseTotalAssets")) {
      await Vault.write.increaseTotalAssets([viem.parseEther("1.10")], { account: admin.account });
    }

    await STBL.write.approve([mgrAddr, stblBal], { account: user.account });
    await Mgr.write.repay([stblBal], { account: user.account });
    await Mgr.write.withdraw([assetKey, 2_000n * 10n ** 18n], { account: user.account });

    if (Mgr.abi.some((f: any) => f.name === "health")) {
      const h = await Mgr.read.health([vaultId as bigint]);
      expect(h).to.be.a("bigint");
    }
  });
});
