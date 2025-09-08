// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ICollateralAdapter {
    function asset() external view returns (address);
    function decimals() external view returns (uint8);

    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function withdraw(
        uint256 shares,
        address receiver,
        address owner
    ) external returns (uint256 assets);

    /// @notice Value of `shares` in underlying assets (or 1e18 scale if rebasing)
    function valueOf(uint256 shares) external view returns (uint256 assets);
}
