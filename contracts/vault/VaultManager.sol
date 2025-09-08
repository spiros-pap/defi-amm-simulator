// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract VaultManager {
    struct CollateralConfig {
        address adapter; // adapter address
        uint256 ltvBps; // 0-10000
        uint256 liqThresholdBps;
        bool enabled;
    }

    struct Position {
        uint256 collateralShares;
        uint256 debt;
    }

    mapping(bytes32 => CollateralConfig) public collateralConfigs; // key by symbol hash
    mapping(address => mapping(bytes32 => Position)) public positions;

    event SetCollateral(
        bytes32 indexed key,
        address adapter,
        uint256 ltvBps,
        uint256 liqThresholdBps,
        bool enabled
    );
    event Deposit(address indexed user, bytes32 indexed key, uint256 assets, uint256 shares);
    event Withdraw(address indexed user, bytes32 indexed key, uint256 shares, uint256 assets);
    event Borrow(address indexed user, uint256 amount);
    event Repay(address indexed user, uint256 amount);
}
