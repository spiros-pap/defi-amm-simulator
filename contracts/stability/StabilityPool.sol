// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract StabilityPool is AccessControl {
    IERC20 public immutable stable;

    mapping(address => uint256) public depositOf;
    uint256 public totalDeposits;

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event StableBurned(address indexed from, uint256 amount);
    event Credited(address indexed to, uint256 amount);

    bytes32 public constant LIQUIDATION_ENGINE_ROLE = keccak256("LIQUIDATION_ENGINE_ROLE");

    constructor(IERC20 _stable, address admin) {
        stable = _stable;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function deposit(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        
        depositOf[msg.sender] += amount;
        totalDeposits += amount;
        
        // Transfer stablecoins from user to pool
        stable.transferFrom(msg.sender, address(this), amount);
        
        emit Deposit(msg.sender, amount);
    }

    function withdraw(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        require(depositOf[msg.sender] >= amount, "Insufficient balance");
        
        depositOf[msg.sender] -= amount;
        totalDeposits -= amount;
        
        // Transfer stablecoins from pool to user
        stable.transfer(msg.sender, amount);
        
        emit Withdraw(msg.sender, amount);
    }

    /**
     * @notice Burn stablecoins from a user's balance (used by liquidation engine)
     * @param from Address to burn tokens from
     * @param amount Amount to burn
     */
    function burnStableFrom(address from, uint256 amount) external onlyRole(LIQUIDATION_ENGINE_ROLE) {
        require(amount > 0, "Amount must be greater than 0");
        
        // Transfer tokens to this contract first, then burn them
        stable.transferFrom(from, address(this), amount);
        
        // Note: In a full implementation, we would call a burn function on the stablecoin contract
        // For now, tokens are held in the stability pool (effectively removing them from circulation)
        
        emit StableBurned(from, amount);
    }

    /**
     * @notice Get available liquidity in the pool
     * @return Available stablecoin balance
     */
    function available() external view returns (uint256) {
        return stable.balanceOf(address(this));
    }

    /**
     * @notice Credit stablecoins to an address (used for liquidation rewards)
     * @param to Address to credit
     * @param amount Amount to credit
     */
    function credit(address to, uint256 amount) external onlyRole(LIQUIDATION_ENGINE_ROLE) {
        require(amount > 0, "Amount must be greater than 0");
        require(stable.balanceOf(address(this)) >= amount, "Insufficient pool balance");
        
        stable.transfer(to, amount);
        
        emit Credited(to, amount);
    }

    /**
     * @notice Set the liquidation engine role
     * @param liquidationEngine Address of the liquidation engine
     */
    function setLiquidationEngine(address liquidationEngine) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(LIQUIDATION_ENGINE_ROLE, liquidationEngine);
    }
}
