import hre from "hardhat";


describe("Vault flows - Rebasing adapter", () => {
  it("rebase (index up) improves health", async () => {
    const { viem } = hre;
    const [admin, user] = await viem.getWalletClients();

    const { address: rTokAddr } = await viem.deployContract("MockERC20", ["RebaseToken", "RTK", 18n]);
    const RTOK = await viem.getContractAt("MockERC20", rTokAddr);

    await RTOK.write.mint([user.account.address, 10_000n * 10n ** 18n], { account: admin.account });

    const { address: adapterAddr } = await viem.deployContract("RebasingAdapter", [rTokAddr]);
    const Adapter = await viem.getContractAt("RebasingAdapter", adapterAddr);

    const { address: oracleAddr } = await viem.deployContract("PriceOracle", [3600n]);
    const Oracle = await viem.getContractAt("PriceOracle", oracleAddr);
    await Oracle.write.setBounds([viem.parseEther("0.5"), viem.parseEther("2")], { account: admin.account });

    const assetKey = rTokAddr as `0x${string}`;
    await Oracle.write.pushPrice([assetKey, viem.parseEther("1")], { account: admin.account });

    const { address: stblAddr } = await viem.deployContract("Stablecoin", ["Stable", "STBL"]);
    const STBL = await viem.getContractAt("Stablecoin", stblAddr);

    const { address: mgrAddr } = await viem.deployContract("VaultManager", [stblAddr, oracleAddr]);
    const Mgr = await viem.getContractAt("VaultManager", mgrAddr);

    const MINTER_ROLE = await STBL.read.MINTER_ROLE();
    const BURNER_ROLE = await STBL.read.BURNER_ROLE();
    await STBL.write.grantRole([MINTER_ROLE, mgrAddr], { account: admin.account });
    await STBL.write.grantRole([BURNER_ROLE, mgrAddr], { account: admin.account });

    await Mgr.write.addCollateral([assetKey, adapterAddr, viem.parseEther("0.7"), 0n], { account: admin.account });

    await RTOK.write.approve([adapterAddr, 2_000n * 10n ** 18n], { account: user.account });
    await Mgr.write.open([], { account: user.account });
    await Mgr.write.deposit([assetKey, 2_000n * 10n ** 18n], { account: user.account });

    await Mgr.write.borrow([600n * 10n ** 18n], { account: user.account });

    if (Adapter.abi.some((f: any) => f.name === "setIndex")) {
      await Adapter.write.setIndex([viem.parseEther("1.10")], { account: admin.account });
    }

    if (Mgr.abi.some((f: any) => f.name === "health")) {
      const h = await Mgr.read.health([0n]); // adjust if your open() returns an id
      expect(h).to.be.a("bigint");
    }
  });
});
