import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('Stablecoin auth', () => {
  it('only MINTER_ROLE can mint; only BURNER_ROLE can burn', async () => {
    const [deployer, alice, bob] = await ethers.getSigners();
    const Stablecoin = await ethers.getContractFactory('Stablecoin');
    const stbl = await Stablecoin.deploy(deployer.address);
    await stbl.waitForDeployment();

    const MINTER_ROLE = await stbl.MINTER_ROLE();
    const BURNER_ROLE = await stbl.BURNER_ROLE();

    await stbl.grantRole(MINTER_ROLE, deployer.address);
    await stbl.mint(alice.address, 100n);
    expect(await stbl.balanceOf(alice.address)).to.equal(100n);

    await expect(stbl.connect(bob).mint(bob.address, 1n)).to.be.rejected;

    await stbl.grantRole(BURNER_ROLE, deployer.address);
    await stbl.burn(alice.address, 40n);
    expect(await stbl.balanceOf(alice.address)).to.equal(60n);

    await expect(stbl.connect(bob).burn(alice.address, 1n)).to.be.rejected;
  });
});
