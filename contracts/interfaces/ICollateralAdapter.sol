// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ICollateralAdapter {
    function asset() external view returns (address);
    function decimals() external view returns (uint8);

    /// Pull `assets` from `from` and credit shares to `receiver`.
    function depositFrom(address from, uint256 assets, address receiver) external returns (uint256 shares);

    /// Burn `shares` and send assets to `receiver`. `owner` provides shares.
    function withdraw(uint256 shares, address receiver, address owner) external returns (uint256 assets);

    /// Value of `shares` in underlying assets.
    function valueOf(uint256 shares) external view returns (uint256 assets);
}