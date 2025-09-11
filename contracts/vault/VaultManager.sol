// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ICollateralAdapter} from "../interfaces/ICollateralAdapter.sol";
import {Stablecoin} from "../Stablecoin.sol";
import {GuardedOracle} from "../oracles/GuardedOracle.sol";
import {WadMath} from "../lib/WadMath.sol";

contract VaultManager is ReentrancyGuard, AccessControl {
    using WadMath for uint256;

    bytes32 public constant RISK_ADMIN = keccak256("RISK_ADMIN");

    Stablecoin public immutable stable;
    GuardedOracle public immutable oracle;

    struct CollateralConfig {
        address adapter;       // adapter contract
        uint16  ltvBps;        // 0..10000
        bool    enabled;
    }

    struct Position {
        uint256 shares;        // collateral shares held by vault
        uint256 debt;          // stablecoin debt (WAD 1e18)
    }

    mapping(bytes32 => CollateralConfig) public collaterals; // key: keccak256("ASSET")
    mapping(address => mapping(bytes32 => Position)) public positions;

    event SetCollateral(bytes32 indexed key, address adapter, uint16 ltvBps, bool enabled);
    event Deposit(address indexed user, bytes32 indexed key, uint256 assets, uint256 shares);
    event Withdraw(address indexed user, bytes32 indexed key, uint256 shares, uint256 assets);
    event Borrow(address indexed user, uint256 amount);
    event Repay(address indexed user, uint256 amount);

    error CollateralDisabled();
    error UnsafePosition();
    error NotEnoughShares();

    constructor(Stablecoin _stable, GuardedOracle _oracle, address admin) {
        stable = _stable;
        oracle = _oracle;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(RISK_ADMIN, admin);
    }

    // --- risk config ---
    function setCollateral(bytes32 key, address adapter, uint16 ltvBps, bool enabled) external onlyRole(RISK_ADMIN) {
        collaterals[key] = CollateralConfig({adapter: adapter, ltvBps: ltvBps, enabled: enabled});
        emit SetCollateral(key, adapter, ltvBps, enabled);
    }

    // --- flows ---
    function deposit(bytes32 key, uint256 assets) external nonReentrant {
        CollateralConfig memory c = collaterals[key];
        if (!c.enabled) revert CollateralDisabled();

        uint256 shares = ICollateralAdapter(c.adapter).depositFrom(msg.sender, assets, address(this));
        positions[msg.sender][key].shares += shares;

        emit Deposit(msg.sender, key, assets, shares);
    }

    function withdraw(bytes32 key, uint256 shares, address receiver) external nonReentrant {
        CollateralConfig memory c = collaterals[key];
        Position storage p = positions[msg.sender][key];
        if (p.shares < shares) revert NotEnoughShares();

        uint256 assets = ICollateralAdapter(c.adapter).withdraw(shares, receiver, address(this));
        p.shares -= shares;

        // post-withdraw health check
        if (!_isHealthy(p, c, key)) revert UnsafePosition();

        emit Withdraw(msg.sender, key, shares, assets);
    }

    function borrow(bytes32 key, uint256 amount) external nonReentrant {
        CollateralConfig memory c = collaterals[key];
        Position storage p = positions[msg.sender][key];

        p.debt += amount;
        if (!_isHealthy(p, c, key)) { p.debt -= amount; revert UnsafePosition(); }

        stable.mint(msg.sender, amount);
        emit Borrow(msg.sender, amount);
    }

    function repay(bytes32 key, uint256 amount) external nonReentrant {
        Position storage p = positions[msg.sender][key];
        if (amount > p.debt) amount = p.debt;
        stable.burn(msg.sender, amount);
        p.debt -= amount;
        emit Repay(msg.sender, amount);
    }

    // --- views ---
    function health(address user, bytes32 key) external view returns (uint256 collateralValueWad, uint256 debt, uint16 ltvBps, bool healthy) {
        CollateralConfig memory c = collaterals[key];
        Position memory p = positions[user][key];
        (collateralValueWad, debt, ltvBps, healthy) = _health(p, c, key);
    }

    function _isHealthy(Position memory p, CollateralConfig memory c, bytes32 key) internal view returns (bool) {
        (, , , bool h) = _health(p, c, key);
        return h;
    }

    function _health(Position memory p, CollateralConfig memory c, bytes32 key) internal view returns (
        uint256 collateralValueWad, uint256 debt, uint16 ltvBps, bool healthy
    ) {
        if (!c.enabled) return (0, p.debt, 0, p.debt == 0);
        uint256 assets = ICollateralAdapter(c.adapter).valueOf(p.shares); // underlying units
        (uint256 priceWad, ) = oracle.getPrice(ICollateralAdapter(c.adapter).asset());
        // collateral value in WAD (USD)
        collateralValueWad = assets.mulWad(priceWad);
        debt = p.debt;
        ltvBps = c.ltvBps;
        healthy = (debt * 10000) <= (collateralValueWad * ltvBps) / 1e14; // (valueWad * ltvBps / 1e4) >= debt
        // simplified: multiply first to keep precision; both sides in WAD
    }
}