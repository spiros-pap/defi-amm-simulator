// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {ICollateralAdapter} from "../interfaces/ICollateralAdapter.sol";

contract ERC4626Adapter is ICollateralAdapter {
    IERC4626 public immutable vault;

    constructor(IERC4626 _vault) {
        vault = _vault;
    }

    function asset() external view override returns (address) {
        return vault.asset();
    }

    function decimals() external view override returns (uint8) {
        return IERC20Metadata(vault.asset()).decimals(); // ← use metadata interface
    }

    function deposit(uint256 assets, address receiver) external override returns (uint256 shares) {
        IERC20Metadata(vault.asset()).transferFrom(msg.sender, address(this), assets);
        IERC20Metadata(vault.asset()).approve(address(vault), assets);
        shares = vault.deposit(assets, receiver);
    }

    function withdraw(
        uint256 shares,
        address receiver,
        address owner
    ) external override returns (uint256 assets) {
        assets = vault.redeem(shares, receiver, owner);
    }

    function valueOf(uint256 shares) external view override returns (uint256 assets) {
        assets = vault.previewRedeem(shares);
    }
}
