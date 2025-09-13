// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IStabilityPool
 * @notice Interface for stability pool operations during liquidations
 */
interface IStabilityPool {
    /**
     * @notice Burn stable tokens from a user's balance to cancel debt
     * @param from Address to burn tokens from
     * @param amount Amount of tokens to burn
     */
    function burnStableFrom(address from, uint256 amount) external;

    /**
     * @notice Get available stable tokens in the pool for debt cancellation
     * @return Available token amount
     */
    function available() external view returns (uint256);

    /**
     * @notice Credit liquidation rewards to an address
     * @param to Address to credit rewards to
     * @param amount Amount to credit
     */
    function credit(address to, uint256 amount) external;
}

/**
 * @title MockStabilityPool
 * @notice Mock implementation of IStabilityPool for testing and MVP
 */
contract MockStabilityPool is IStabilityPool {
    mapping(address => uint256) public balances;
    mapping(address => uint256) public credits;
    uint256 public totalAvailable;

    event StableBurned(address indexed from, uint256 amount);
    event RewardCredited(address indexed to, uint256 amount);

    /**
     * @notice Constructor to set initial available tokens
     * @param _initialAvailable Initial amount available for liquidations
     */
    constructor(uint256 _initialAvailable) {
        totalAvailable = _initialAvailable;
    }

    /**
     * @notice Burn stable tokens from a user (mock implementation)
     * @param from Address to burn from
     * @param amount Amount to burn
     */
    function burnStableFrom(address from, uint256 amount) external override {
        // In a real implementation, this would burn actual tokens
        // For mock, we just reduce the available balance
        require(totalAvailable >= amount, "Insufficient pool balance");
        totalAvailable -= amount;
        emit StableBurned(from, amount);
    }

    /**
     * @notice Get available stable tokens for liquidations
     * @return Available amount
     */
    function available() external view override returns (uint256) {
        return totalAvailable;
    }

    /**
     * @notice Credit liquidation rewards to an address
     * @param to Address to credit
     * @param amount Amount to credit
     */
    function credit(address to, uint256 amount) external override {
        credits[to] += amount;
        emit RewardCredited(to, amount);
    }

    /**
     * @notice Add funds to the pool (for testing)
     * @param amount Amount to add
     */
    function addFunds(uint256 amount) external {
        totalAvailable += amount;
    }

    /**
     * @notice Get credited rewards for an address
     * @param account Address to check
     * @return Credited amount
     */
    function getCreditedRewards(address account) external view returns (uint256) {
        return credits[account];
    }
}