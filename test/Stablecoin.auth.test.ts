import { expect } from "chai";
import { viem } from "hardhat";

describe("Stablecoin auth", () => {
  it("only MINTER_ROLE can mint; only BURNER_ROLE can burn", async () => {
    const [admin, alice, bob] = await viem.getWalletClients();

    const { address: stblAddr } = await viem.deployContract("Stablecoin", ["Stable", "STBL"]);
    const STBL = await viem.getContractAt("Stablecoin", stblAddr);

    const DEFAULT_ADMIN_ROLE = await STBL.read.DEFAULT_ADMIN_ROLE();
    const MINTER_ROLE = await STBL.read.MINTER_ROLE();
    const BURNER_ROLE  = await STBL.read.BURNER_ROLE();

    if (STBL.abi.some((f: any) => f.name === "grantRole")) {
      await STBL.write.grantRole([DEFAULT_ADMIN_ROLE, admin.account.address], { account: admin.account });
    }

    await STBL.write.grantRole([MINTER_ROLE, alice.account.address], { account: admin.account });
    await STBL.write.grantRole([BURNER_ROLE, alice.account.address], { account: admin.account });

    let failed = false;
    try {
      await STBL.write.mint([bob.account.address, 1_000n * 10n ** 18n], { account: bob.account });
    } catch { failed = true; }
    expect(failed).to.equal(true);

    await STBL.write.mint([bob.account.address, 1_000n * 10n ** 18n], { account: alice.account });
    const bal1 = await STBL.read.balanceOf([bob.account.address]);
    expect(bal1).to.equal(1_000n * 10n ** 18n);

    failed = false;
    try {
      await STBL.write.burn([bob.account.address, 1n], { account: bob.account });
    } catch { failed = true; }
    expect(failed).to.equal(true);

    await STBL.write.burn([bob.account.address, 100n * 10n ** 18n], { account: alice.account });
    const bal2 = await STBL.read.balanceOf([bob.account.address]);
    expect(bal2).to.equal(900n * 10n ** 18n);
  });
});
