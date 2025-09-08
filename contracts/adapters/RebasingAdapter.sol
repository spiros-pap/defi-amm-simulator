// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ICollateralAdapter} from "../interfaces/ICollateralAdapter.sol";

/// @notice Skeleton for a rebasing collateral wrapper (e.g., stETH-like)
contract RebasingAdapter is ICollateralAdapter {
    address public immutable underlying;
    uint8 public immutable underlyingDecimals;

    mapping(address => uint256) public sharesOf;
    uint256 public totalShares;

    constructor(address _underlying, uint8 _decimals) {
        underlying = _underlying;
        underlyingDecimals = _decimals;
    }

    function asset() external view override returns (address) {
        return underlying;
    }
    function decimals() external view override returns (uint8) {
        return underlyingDecimals;
    }

    function deposit(uint256 assets, address receiver) external override returns (uint256 shares) {
        // stub: 1:1 shares for now
        shares = assets;
        sharesOf[receiver] += shares;
        totalShares += shares;
        // real impl would transferFrom underlying
    }

    function withdraw(
        uint256 shares,
        address /*receiver*/,
        address owner
    ) external override returns (uint256 assets) {
        // stub: 1:1
        require(sharesOf[owner] >= shares, "insufficient shares");
        sharesOf[owner] -= shares;
        totalShares -= shares;
        assets = shares;
        // real impl would transfer underlying to receiver
    }

    function valueOf(uint256 shares) external pure override returns (uint256 assets) {
        return shares;
    }
}
