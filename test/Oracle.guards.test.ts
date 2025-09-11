import { expect } from "chai";
import { viem } from "hardhat";

describe("Oracle guards", () => {
  it("stale, bounds, paused, and TWAP", async () => {
    const [admin] = await viem.getWalletClients();
    const publicClient = await viem.getPublicClient();

    const { address: oracleAddr } = await viem.deployContract("PriceOracle", [3600n]);
    const Oracle = await viem.getContractAt("PriceOracle", oracleAddr);

    await Oracle.write.setBounds([viem.parseEther("0.5"), viem.parseEther("2")], { account: admin.account });

    if (Oracle.abi.some((f: any) => f.name === "setPaused")) {
      await Oracle.write.setPaused([false], { account: admin.account });
    }

    const asset = admin.account.address as `0x${string}`;
    await Oracle.write.pushPrice([asset, viem.parseEther("1")], { account: admin.account });

    const [p1, last1] = await Oracle.read.getPrice([asset]);
    expect(p1).to.equal(viem.parseEther("1"));
    expect(last1).to.be.a("bigint");

    await publicClient.increaseTime({ seconds: 3601 });

    let threw = false;
    try { await Oracle.read.getPrice([asset]); } catch { threw = true; }
    expect(threw).to.equal(true);

    await Oracle.write.pushPrice([asset, viem.parseEther("10")], { account: admin.account });
    threw = false;
    try { await Oracle.read.getPrice([asset]); } catch { threw = true; }
    expect(threw).to.equal(true);

    if (Oracle.abi.some((f: any) => f.name === "setPaused")) {
      await Oracle.write.setPaused([true], { account: admin.account });
      threw = false;
      try { await Oracle.read.getPrice([asset]); } catch { threw = true; }
      expect(threw).to.equal(true);
      await Oracle.write.setPaused([false], { account: admin.account });
    }

    if (Oracle.abi.some((f: any) => f.name === "getTwap")) {
      await Oracle.write.pushPrice([asset, viem.parseEther("1.1")], { account: admin.account });
      await Oracle.write.pushPrice([asset, viem.parseEther("0.9")], { account: admin.account });
      const twap = await Oracle.read.getTwap([asset]);
      expect(twap).to.be.a("bigint");
    }
  });
});
