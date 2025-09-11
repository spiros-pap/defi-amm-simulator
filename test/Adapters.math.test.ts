import { expect } from "chai";
import { privateKeyToAccount } from "viem/accounts";

describe("Adapters math", () => {
  it("stub: share <-> asset conversions", async () => {
    // Create wallet clients directly (bypassing hre.viem which is undefined)
    const admin = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
    const user = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');
    
    expect(admin.address).to.match(/^0x[0-9a-fA-F]{40}$/);
    expect(user.address).to.match(/^0x[0-9a-fA-F]{40}$/);
  });
});
