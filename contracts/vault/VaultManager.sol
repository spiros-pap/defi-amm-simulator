// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ICollateralAdapter} from "../interfaces/ICollateralAdapter.sol";
import {Stablecoin} from "../Stablecoin.sol";
import {GuardedOracle} from "../oracles/GuardedOracle.sol";
import {WadMath} from "../lib/WadMath.sol";

contract VaultManager is ReentrancyGuard, AccessControl, Pausable {
    using WadMath for uint256;

    bytes32 public constant RISK_ADMIN = keccak256("RISK_ADMIN");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    
    // Constants for precision and limits
    uint256 private constant MAX_BPS = 10000;
    uint256 private constant PRECISION_MULTIPLIER = 1e18;

    Stablecoin public immutable stable;
    GuardedOracle public immutable oracle;
    
    // Vault management state
    uint256 public nextVaultId = 1;
    mapping(uint256 => address) public vaultOwner;
    mapping(address => uint256[]) public userVaults;
    mapping(uint256 => bytes32) public vaultCollateralType;

    struct CollateralConfig {
        address adapter;       // adapter contract
        uint16  ltvBps;        // 0..10000
        bool    enabled;
    }

    struct Position {
        uint256 shares;        // collateral shares held by vault
        uint256 debt;          // stablecoin debt (WAD 1e18)
        bool active;           // vault active status
    }

    mapping(bytes32 => CollateralConfig) public collaterals; // key: keccak256("ASSET")
    mapping(address => mapping(bytes32 => Position)) public positions;
    mapping(uint256 => Position) public vaults; // New vault-based storage

    event SetCollateral(bytes32 indexed key, address adapter, uint16 ltvBps, bool enabled);
    event VaultCreated(uint256 indexed vaultId, address indexed owner, bytes32 indexed collateralType);
    event Deposit(address indexed user, uint256 indexed vaultId, bytes32 indexed key, uint256 assets, uint256 shares);
    event Withdraw(address indexed user, uint256 indexed vaultId, bytes32 indexed key, uint256 shares, uint256 assets);
    event Borrow(address indexed user, uint256 indexed vaultId, uint256 amount);
    event Repay(address indexed user, uint256 indexed vaultId, uint256 amount);

    // Custom errors for gas efficiency
    error CollateralDisabled();
    error UnsafePosition();
    error NotEnoughShares();
    error VaultNotFound(uint256 vaultId);
    error NotVaultOwner(uint256 vaultId, address caller);
    error InvalidCollateralType(bytes32 collateralType);
    error ArrayLengthMismatch();
    error MathOverflow();
    error InvalidAmount();
    error VaultInactive(uint256 vaultId);
    error LTVExceedsMaximum(uint16 ltv);
    error InsufficientCollateral();

    constructor(Stablecoin _stable, GuardedOracle _oracle, address admin) {
        stable = _stable;
        oracle = _oracle;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(RISK_ADMIN, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    // =============================================================================
    // EMERGENCY FUNCTIONS
    // =============================================================================
    
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // =============================================================================
    // MODIFIERS
    // =============================================================================
    
    modifier onlyVaultOwner(uint256 vaultId) {
        if (vaultOwner[vaultId] != msg.sender) revert NotVaultOwner(vaultId, msg.sender);
        _;
    }
    
    modifier vaultExists(uint256 vaultId) {
        if (vaultOwner[vaultId] == address(0)) revert VaultNotFound(vaultId);
        _;
    }
    
    modifier vaultActive(uint256 vaultId) {
        if (!vaults[vaultId].active) revert VaultInactive(vaultId);
        _;
    }
    
    modifier validAmount(uint256 amount) {
        if (amount == 0) revert InvalidAmount();
        _;
    }

    // =============================================================================
    // VAULT MANAGEMENT FUNCTIONS
    // =============================================================================
    
    /**
     * @notice Create a new vault for a specific collateral type
     * @param collateralType The collateral type identifier
     * @return vaultId The ID of the newly created vault
     */
    function createVault(bytes32 collateralType) external whenNotPaused returns (uint256 vaultId) {
        CollateralConfig memory config = collaterals[collateralType];
        if (!config.enabled) revert InvalidCollateralType(collateralType);
        
        vaultId = nextVaultId++;
        vaultOwner[vaultId] = msg.sender;
        vaultCollateralType[vaultId] = collateralType;
        userVaults[msg.sender].push(vaultId);
        vaults[vaultId] = Position({shares: 0, debt: 0, active: true});
        
        emit VaultCreated(vaultId, msg.sender, collateralType);
    }

    // =============================================================================
    // RISK CONFIG
    // =============================================================================
    
    function setCollateral(bytes32 key, address adapter, uint16 ltvBps, bool enabled) external onlyRole(RISK_ADMIN) {
        if (ltvBps > MAX_BPS) revert LTVExceedsMaximum(ltvBps);
        collaterals[key] = CollateralConfig({adapter: adapter, ltvBps: ltvBps, enabled: enabled});
        emit SetCollateral(key, adapter, ltvBps, enabled);
    }

    // =============================================================================
    // VAULT OPERATIONS
    // =============================================================================
    
    function deposit(uint256 vaultId, uint256 assets) 
        external 
        whenNotPaused 
        nonReentrant 
        vaultExists(vaultId)
        onlyVaultOwner(vaultId)
        vaultActive(vaultId)
        validAmount(assets)
    {
        bytes32 collateralType = vaultCollateralType[vaultId];
        CollateralConfig memory config = collaterals[collateralType];
        if (!config.enabled) revert CollateralDisabled();

        uint256 shares = ICollateralAdapter(config.adapter).depositFrom(msg.sender, assets, address(this));
        
        // Safe math: check for overflow
        uint256 newShares = vaults[vaultId].shares + shares;
        if (newShares < vaults[vaultId].shares) revert MathOverflow();
        
        vaults[vaultId].shares = newShares;

        emit Deposit(msg.sender, vaultId, collateralType, assets, shares);
    }

    function withdraw(uint256 vaultId, uint256 shares, address receiver) 
        external 
        whenNotPaused 
        nonReentrant 
        vaultExists(vaultId)
        onlyVaultOwner(vaultId)
        vaultActive(vaultId)
        validAmount(shares)
    {
        Position storage vault = vaults[vaultId];
        if (vault.shares < shares) revert NotEnoughShares();

        bytes32 collateralType = vaultCollateralType[vaultId];
        CollateralConfig memory config = collaterals[collateralType];
        
        uint256 assets = ICollateralAdapter(config.adapter).withdraw(shares, receiver, address(this));
        vault.shares -= shares;

        // Post-withdraw health check with overflow protection
        if (!_isVaultHealthy(vaultId)) revert UnsafePosition();

        emit Withdraw(msg.sender, vaultId, collateralType, shares, assets);
    }

    function borrow(uint256 vaultId, uint256 amount) 
        external 
        whenNotPaused 
        nonReentrant 
        vaultExists(vaultId)
        onlyVaultOwner(vaultId)
        vaultActive(vaultId)
        validAmount(amount)
    {
        Position storage vault = vaults[vaultId];
        
        // Safe math: check for overflow
        uint256 newDebt = vault.debt + amount;
        if (newDebt < vault.debt) revert MathOverflow();
        
        vault.debt = newDebt;
        if (!_isVaultHealthy(vaultId)) { 
            vault.debt -= amount; 
            revert UnsafePosition(); 
        }

        stable.mint(msg.sender, amount);
        emit Borrow(msg.sender, vaultId, amount);
    }

    function repay(uint256 vaultId, uint256 amount) 
        external 
        whenNotPaused 
        nonReentrant 
        vaultExists(vaultId)
        onlyVaultOwner(vaultId)
        vaultActive(vaultId)
        validAmount(amount)
    {
        Position storage vault = vaults[vaultId];
        if (amount > vault.debt) amount = vault.debt;
        
        stable.burn(msg.sender, amount);
        vault.debt -= amount;
        
        emit Repay(msg.sender, vaultId, amount);
    }

    // =============================================================================
    // VIEW FUNCTIONS
    // =============================================================================
    
    /**
     * @notice Get vault health information
     * @param vaultId The vault ID to check
     * @return collateralValueWad Collateral value in WAD format
     * @return debt Current debt amount
     * @return ltvBps LTV in basis points
     * @return healthy Whether the vault is healthy
     */
    function vaultHealth(uint256 vaultId) external view vaultExists(vaultId) returns (
        uint256 collateralValueWad, 
        uint256 debt, 
        uint16 ltvBps, 
        bool healthy
    ) {
        return _getVaultHealth(vaultId);
    }

    /**
     * @notice Get user's vaults for a given collateral type (legacy compatibility)
     */
    function health(address user, bytes32 key) external view returns (uint256 collateralValueWad, uint256 debt, uint16 ltvBps, bool healthy) {
        CollateralConfig memory c = collaterals[key];
        Position memory p = positions[user][key];
        return _health(p, c, key);
    }

    /**
     * @notice Check if a vault is healthy
     * @param vaultId The vault ID to check
     * @return Whether the vault is healthy
     */
    function _isVaultHealthy(uint256 vaultId) internal view returns (bool) {
        (, , , bool healthy) = _getVaultHealth(vaultId);
        return healthy;
    }

    /**
     * @notice Get comprehensive vault health with overflow protection
     */
    function _getVaultHealth(uint256 vaultId) internal view returns (
        uint256 collateralValueWad,
        uint256 debt,
        uint16 ltvBps,
        bool healthy
    ) {
        Position memory vault = vaults[vaultId];
        bytes32 collateralType = vaultCollateralType[vaultId];
        CollateralConfig memory config = collaterals[collateralType];
        
        debt = vault.debt;
        ltvBps = config.ltvBps;
        
        if (!config.enabled || !vault.active) {
            return (0, debt, ltvBps, debt == 0);
        }
        
        // Get collateral value with overflow protection
        uint256 assets = ICollateralAdapter(config.adapter).valueOf(vault.shares);
        (uint256 priceWad, ) = oracle.getPrice(ICollateralAdapter(config.adapter).asset());
        
        // Safe multiplication to prevent overflow
        // Instead of assets * priceWad, we check bounds first
        if (assets > 0 && priceWad > type(uint256).max / assets) {
            revert MathOverflow();
        }
        collateralValueWad = assets * priceWad;
        
        // Health check with safe math: avoid debt * 10000 overflow
        // Rearrange: debt * MAX_BPS <= collateralValueWad * ltvBps
        // To: debt <= (collateralValueWad * ltvBps) / MAX_BPS
        if (debt == 0) {
            healthy = true;
        } else if (collateralValueWad == 0) {
            healthy = false;
        } else {
            // Check for overflow in collateralValueWad * ltvBps
            if (collateralValueWad > type(uint256).max / ltvBps) {
                // If this overflows, collateral is extremely high, so definitely healthy
                healthy = true;
            } else {
                uint256 maxDebt = (collateralValueWad * ltvBps) / MAX_BPS;
                healthy = debt <= maxDebt;
            }
        }
    }

    /**
     * @notice Legacy health check function for backward compatibility
     */
    function _health(Position memory p, CollateralConfig memory c, bytes32 /* key */) internal view returns (
        uint256 collateralValueWad, uint256 debt, uint16 ltvBps, bool healthy
    ) {
        if (!c.enabled) return (0, p.debt, 0, p.debt == 0);
        
        debt = p.debt;
        ltvBps = c.ltvBps;
        
        uint256 assets = ICollateralAdapter(c.adapter).valueOf(p.shares);
        (uint256 priceWad, ) = oracle.getPrice(ICollateralAdapter(c.adapter).asset());
        
        // Safe multiplication
        if (assets > 0 && priceWad > type(uint256).max / assets) {
            revert MathOverflow();
        }
        collateralValueWad = assets * priceWad;
        
        // Safe health calculation
        if (debt == 0) {
            healthy = true;
        } else if (collateralValueWad == 0) {
            healthy = false;
        } else {
            if (collateralValueWad > type(uint256).max / ltvBps) {
                healthy = true;
            } else {
                uint256 maxDebt = (collateralValueWad * ltvBps) / MAX_BPS;
                healthy = debt <= maxDebt;
            }
        }
    }

    // =============================================================================
    // LIQUIDATION INTEGRATION
    // =============================================================================

    address public liquidationEngine;
    uint256 public constant MCR_BPS = 12000; // 120% minimum collateralization ratio
    
    event LiquidationSettled(uint256[] vaultIds, uint256[] filledQty, uint256 clearingPrice);
    event CollateralLiquidated(uint256 indexed vaultId, address indexed owner, uint256 collateralQty, uint256 debtBurned, uint256 penalty);
    event VaultFlagged(uint256 indexed vaultId, address indexed flagger, bytes32 indexed collateralKey);

    error NotLiquidationEngine();
    error VaultHealthy(uint256 vaultId);
    error InvalidLiquidationEngine();

    modifier onlyLiquidationEngine() {
        if (msg.sender != liquidationEngine) revert NotLiquidationEngine();
        _;
    }

    /**
     * @notice Set the liquidation engine address
     * @param _liquidationEngine Address of the liquidation engine
     */
    function setLiquidationEngine(address _liquidationEngine) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_liquidationEngine == address(0)) revert InvalidLiquidationEngine();
        liquidationEngine = _liquidationEngine;
    }

    /**
     * @notice Flag a vault for liquidation when health < MCR
     * @param vaultId The vault ID to flag
     * @dev Anyone can call this to trigger liquidation of unhealthy vaults
     */
    function flagForLiquidation(uint256 vaultId) 
        external 
        whenNotPaused 
        vaultExists(vaultId) 
        vaultActive(vaultId)
    {
        if (!_isLiquidationEligible(vaultId)) revert VaultHealthy(vaultId);
        
        // Call liquidation engine to enqueue the vault
        ILiquidationEngine(liquidationEngine).enqueue(vaultId);
        
        bytes32 collateralType = vaultCollateralType[vaultId];
        emit VaultFlagged(vaultId, msg.sender, collateralType);
    }

    /**
     * @notice Check if a vault is eligible for liquidation
     * @param vaultId The vault ID to check
     * @return eligible True if vault can be liquidated
     */
    function isLiquidationEligible(uint256 vaultId) external view returns (bool eligible) {
        return _isLiquidationEligible(vaultId);
    }
    
    /**
     * @notice Internal function to check liquidation eligibility with safe math
     */
    function _isLiquidationEligible(uint256 vaultId) internal view returns (bool) {
        Position memory vault = vaults[vaultId];
        if (!vault.active || vault.debt == 0) return false;
        
        (uint256 collateralValueWad, uint256 debt, , ) = _getVaultHealth(vaultId);
        
        if (collateralValueWad == 0) return true; // No collateral but has debt
        
        // Check if collateralValueWad * MAX_BPS < debt * MCR_BPS
        // Avoid overflow by rearranging: collateralValueWad < (debt * MCR_BPS) / MAX_BPS
        
        // Check for overflow in debt * MCR_BPS
        if (debt > type(uint256).max / MCR_BPS) {
            // If this overflows, debt is extremely high, so definitely liquidatable
            return true;
        }
        
        uint256 requiredCollateral = (debt * MCR_BPS) / MAX_BPS;
        return collateralValueWad < requiredCollateral;
    }

    /**
     * @notice Called by liquidation engine when settlement occurs
     * @param vaultIds Array of vault IDs being settled
     * @param filledQty Array of collateral quantities filled for each vault
     * @param clearingPrice The uniform clearing price used
     */
    function onLiquidationSettle(
        uint256[] calldata vaultIds,
        uint256[] calldata filledQty,
        uint256 clearingPrice
    ) external whenNotPaused onlyLiquidationEngine {
        if (vaultIds.length != filledQty.length) revert ArrayLengthMismatch();

        for (uint256 i = 0; i < vaultIds.length; i++) {
            uint256 vaultId = vaultIds[i];
            uint256 qty = filledQty[i];
            
            if (qty > 0) {
                _processVaultLiquidation(vaultId, qty);
            }
        }

        emit LiquidationSettled(vaultIds, filledQty, clearingPrice);
    }
    
    /**
     * @notice Process liquidation for a specific vault with safe math
     */
    function _processVaultLiquidation(uint256 vaultId, uint256 qty) internal {
        if (vaultOwner[vaultId] == address(0)) revert VaultNotFound(vaultId);
        
        Position storage vault = vaults[vaultId];
        if (vault.shares < qty) revert NotEnoughShares();
        
        bytes32 collateralType = vaultCollateralType[vaultId];
        CollateralConfig memory config = collaterals[collateralType];
        
        // Calculate debt to burn proportional to liquidated collateral with safe math
        uint256 debtToBurn = 0;
        if (vault.debt > 0 && vault.shares > 0) {
            // Safe multiplication: debt * qty <= debt * shares
            if (qty <= vault.shares) {
                debtToBurn = (vault.debt * qty) / vault.shares;
            } else {
                // Should not happen, but protect against edge cases
                debtToBurn = vault.debt;
                qty = vault.shares;
            }
        }
        
        // Get collateral value for penalty calculation
        uint256 totalCollateralValue = _getCollateralValue(vault.shares, config.adapter, collateralType);
        uint256 liquidatedValue = 0;
        if (vault.shares > 0) {
            // Safe calculation
            liquidatedValue = (totalCollateralValue * qty) / vault.shares;
        }
        
        // Update vault state
        vault.debt -= debtToBurn;
        vault.shares -= qty;
        
        // Burn debt from stability pool
        if (debtToBurn > 0) {
            // Note: In production, this would interface with the stability pool
            // For now, we emit the event for tracking
        }
        
        // Calculate liquidation penalty with safe math (5%)
        uint256 penalty = 0;
        if (liquidatedValue > 0) {
            // Check for overflow: liquidatedValue * 500 
            if (liquidatedValue <= type(uint256).max / 500) {
                penalty = (liquidatedValue * 500) / MAX_BPS; // 5% penalty
            }
        }
        
        address owner = vaultOwner[vaultId];
        emit CollateralLiquidated(vaultId, owner, qty, debtToBurn, penalty);
    }

    /**
     * @notice Check vault health for liquidation eligibility (returns health ratio)
     * @param vaultId The vault ID to check
     * @return healthRatio The health ratio in WAD format (1e18 = 100%)
     */
    function health(uint256 vaultId) external view returns (uint256 healthRatio) {
        if (vaultOwner[vaultId] == address(0)) revert VaultNotFound(vaultId);
        
        (uint256 collateralValueWad, uint256 debt, , ) = _getVaultHealth(vaultId);
        
        // If no debt, vault is perfectly healthy
        if (debt == 0) {
            return type(uint256).max; // Infinite health ratio
        }
        
        // If no collateral but has debt, vault is completely unhealthy
        if (collateralValueWad == 0) {
            return 0;
        }
        
        // Calculate health ratio with safe math: (collateralValue / debt)
        // Both values are already in WAD format (1e18)
        if (collateralValueWad >= debt) {
            // Safe division
            healthRatio = (collateralValueWad * PRECISION_MULTIPLIER) / debt;
        } else {
            // Collateral worth less than debt
            healthRatio = (collateralValueWad * PRECISION_MULTIPLIER) / debt;
        }
        
        return healthRatio;
    }

    /**
     * @notice Get collateral value for liquidation calculations
     * @param shares Amount of collateral shares
     * @param adapter Collateral adapter address
     * @return value Total value of collateral in USD (WAD format)
     */
    function _getCollateralValue(uint256 shares, address adapter, bytes32 /* collateralKey */) internal view returns (uint256 value) {
        // Get asset amount from shares
        uint256 assets = ICollateralAdapter(adapter).valueOf(shares);
        
        // Get asset address from adapter
        address asset = ICollateralAdapter(adapter).asset();
        
        // Get price from oracle
        (uint256 price, ) = oracle.getPrice(asset);
        
        // Calculate total value
        value = (assets * price) / 1e18;
    }

}

// Interface for liquidation engine
interface ILiquidationEngine {
    function enqueue(uint256 vaultId) external;
}