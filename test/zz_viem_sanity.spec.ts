import { expect } from "chai";
import hre from "hardhat";

describe("viem sanity", () => {
  it("HRE exposes viem helpers", async () => {
    // quick visibility
    // console.log("typeof hre.viem:", typeof (hre as any).viem);
    expect((hre as any).viem, "hre.viem should be defined").to.exist;

    const [w] = await (hre as any).viem.getWalletClients();
    expect(w.account.address).to.match(/^0x[0-9a-fA-F]{40}$/);
  });
});