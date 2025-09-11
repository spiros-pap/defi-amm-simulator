import { expect } from "chai";
import viem from "hardhat";

describe("Counter", () => {
  it("increments and emits", async () => {
    const [admin, user] = await viem.getWalletClients();
    const [deployer] = await viem.getWalletClients();

    // deploy with viem
    const { address } = await viem.deployContract("Counter");
    const Counter = await viem.getContractAt("Counter", address);

    // call inc()
    await Counter.write.inc([], { account: deployer.account });

    // verify state
    const x = await Counter.read.x();
    expect(x).to.equal(1n);
  });

  it("sum of increments matches value", async () => {
    const [deployer] = await viem.getWalletClients();

    const { address } = await viem.deployContract("Counter");
    const Counter = await viem.getContractAt("Counter", address);

    for (let i = 1n; i <= 10n; i++) {
      await Counter.write.incBy([i], { account: deployer.account });
    }

    const x = await Counter.read.x();
    expect(x).to.equal(55n);
  });
});
