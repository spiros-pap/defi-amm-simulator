import { expect } from "chai";
import { viem } from "hardhat";

describe("smoke", () => {
  it("hardhat + mocha + viem alive", async () => {
    const [admin, user] = await viem.getWalletClients();
    const [w] = await viem.getWalletClients();    // ✅ wallet clients
    expect(w.account.address).to.match(/^0x[0-9a-fA-F]{40}$/);

    const { address } = await viem.deployContract("Counter");          // ✅ deploy
    const Counter = await viem.getContractAt("Counter", address);      // ✅ get contract

    await Counter.write.inc([], { account: w.account });               // ✅ write
    const x = await Counter.read.x();                                  // ✅ read
    expect(x).to.equal(1n);
  });
});
