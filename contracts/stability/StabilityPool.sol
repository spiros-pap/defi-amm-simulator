// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract StabilityPool is AccessControl, Pausable, ReentrancyGuard {
    IERC20 public immutable stable;

    mapping(address => uint256) public depositOf;
    uint256 public totalDeposits;

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event StableBurned(address indexed from, uint256 amount);
    event Credited(address indexed to, uint256 amount);

    // Custom errors for gas efficiency
    error InvalidAmount();
    error InsufficientBalance();
    error InsufficientPoolBalance();
    error EmergencyModeNotActive();
    error EmergencyModeActive();
    error NoBalanceToWithdraw();

    bytes32 public constant LIQUIDATION_ENGINE_ROLE = keccak256("LIQUIDATION_ENGINE_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    
    bool public emergencyMode;

    event EmergencyModeActivated(address indexed activator);
    event EmergencyModeDeactivated(address indexed deactivator);
    event EmergencyWithdrawal(address indexed user, uint256 amount);

    modifier notInEmergency() {
        if (emergencyMode) revert EmergencyModeActive();
        _;
    }

    constructor(IERC20 _stable, address admin) {
        stable = _stable;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(EMERGENCY_ROLE, admin);
    }

    function deposit(uint256 amount) external whenNotPaused notInEmergency nonReentrant {
        if (amount == 0) revert InvalidAmount();
        
        depositOf[msg.sender] += amount;
        totalDeposits += amount;
        
        // Transfer stablecoins from user to pool
        stable.transferFrom(msg.sender, address(this), amount);
        
        emit Deposit(msg.sender, amount);
    }

    function withdraw(uint256 amount) external whenNotPaused nonReentrant {
        if (amount == 0) revert InvalidAmount();
        if (depositOf[msg.sender] < amount) revert InsufficientBalance();
        
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
    function burnStableFrom(address from, uint256 amount) external whenNotPaused onlyRole(LIQUIDATION_ENGINE_ROLE) nonReentrant {
        if (amount == 0) revert InvalidAmount();
        
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
    function credit(address to, uint256 amount) external whenNotPaused onlyRole(LIQUIDATION_ENGINE_ROLE) nonReentrant {
        if (amount == 0) revert InvalidAmount();
        if (stable.balanceOf(address(this)) < amount) revert InsufficientPoolBalance();
        
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

    // =============================================================================
    // EMERGENCY AND ADMIN FUNCTIONS
    // =============================================================================

    /**
     * @notice Pause the contract (stops deposits, burns, and credits)
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @notice Activate emergency mode (allows emergency withdrawals)
     */
    function activateEmergencyMode() external onlyRole(EMERGENCY_ROLE) {
        emergencyMode = true;
        emit EmergencyModeActivated(msg.sender);
    }

    /**
     * @notice Deactivate emergency mode
     */
    function deactivateEmergencyMode() external onlyRole(EMERGENCY_ROLE) {
        emergencyMode = false;
        emit EmergencyModeDeactivated(msg.sender);
    }

    /**
     * @notice Emergency withdrawal for users when emergency mode is active
     * Allows users to withdraw their deposits even when the contract is paused
     */
    function emergencyWithdraw() external nonReentrant {
        if (!emergencyMode) revert EmergencyModeNotActive();
        
        uint256 userBalance = depositOf[msg.sender];
        if (userBalance == 0) revert NoBalanceToWithdraw();
        
        depositOf[msg.sender] = 0;
        totalDeposits -= userBalance;
        
        // Transfer stablecoins from pool to user
        stable.transfer(msg.sender, userBalance);
        
        emit EmergencyWithdrawal(msg.sender, userBalance);
    }

    /**
     * @notice Grant pauser role to an address
     * @param account Address to grant pauser role to
     */
    function grantPauserRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(PAUSER_ROLE, account);
    }

    /**
     * @notice Grant emergency role to an address
     * @param account Address to grant emergency role to
     */
    function grantEmergencyRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(EMERGENCY_ROLE, account);
    }

    /**
     * @notice Revoke pauser role from an address
     * @param account Address to revoke pauser role from
     */
    function revokePauserRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(PAUSER_ROLE, account);
    }

    /**
     * @notice Revoke emergency role from an address
     * @param account Address to revoke emergency role from
     */
    function revokeEmergencyRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(EMERGENCY_ROLE, account);
    }
}
