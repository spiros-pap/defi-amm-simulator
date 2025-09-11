// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";

/// @notice Minimal ERC4626-like vault for tests with adjustable totalAssets (yield).
contract Mock4626Vault is ERC20, IERC4626 {
    IERC20  public immutable assetToken;
    uint256 private _totalAssets;

    constructor(IERC20 _asset) ERC20("Mock4626 Share", "M4626") {
        assetToken = _asset;
    }

    function asset() external view returns (address) { return address(assetToken); }
    function totalAssets() public view returns (uint256) { return _totalAssets; }

    function convertToShares(uint256 assets) public view returns (uint256) {
        uint256 ts = totalSupply();
        uint256 ta = _totalAssets;
        return ts == 0 || ta == 0 ? assets : assets * ts / ta;
    }

    function convertToAssets(uint256 shares) public view returns (uint256) {
        uint256 ts = totalSupply();
        uint256 ta = _totalAssets;
        return ts == 0 ? shares : shares * ta / ts;
    }

    // ----- preview -----
    function previewDeposit(uint256 assets) external view returns (uint256) { return convertToShares(assets); }
    function previewMint(uint256 shares) external view returns (uint256) { return convertToAssets(shares); }
    function previewWithdraw(uint256 assets) public view returns (uint256) {
        uint256 ts = totalSupply(); uint256 ta = _totalAssets;
        return ts == 0 ? assets : assets * ts / ta;
    }
    function previewRedeem(uint256 shares) public view returns (uint256) { return convertToAssets(shares); }

    // ----- actions -----
    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        shares = convertToShares(assets);
        assetToken.transferFrom(msg.sender, address(this), assets);
        _mint(receiver, shares);
        _totalAssets += assets;
    }

    function mint(uint256 shares, address receiver) external returns (uint256 assets) {
        assets = convertToAssets(shares);
        assetToken.transferFrom(msg.sender, address(this), assets);
        _mint(receiver, shares);
        _totalAssets += assets;
    }

    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
        shares = previewWithdraw(assets); // now public, so internal call is ok
        if (msg.sender != owner) _spendAllowance(owner, msg.sender, shares);
        _burn(owner, shares);
        _totalAssets -= assets;
        assetToken.transfer(receiver, assets);
    }

    function redeem(uint256 shares, address receiver, address owner) public returns (uint256 assets) {
        assets = previewRedeem(shares);
        if (msg.sender != owner) _spendAllowance(owner, msg.sender, shares);
        _burn(owner, shares);
        _totalAssets -= assets;
        assetToken.transfer(receiver, assets);
    }

    // ----- required by IERC4626 (simple permissive implementations) -----
    function maxDeposit(address) external pure returns (uint256) { return type(uint256).max; }
    function maxMint(address) external pure returns (uint256) { return type(uint256).max; }
    function maxWithdraw(address owner) external view returns (uint256) { return convertToAssets(balanceOf(owner)); }
    function maxRedeem(address owner) external view returns (uint256) { return balanceOf(owner); }

    // ----- test helper to simulate yield (adjust accounting) -----
    function simulateYield(uint256 addedAssets) external {
        _totalAssets += addedAssets;
        // For realism, also mint or transfer underlying to this contract in tests if needed
    }
}
