// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @notice Price oracle with staleness + bounds + optional TWAP (ring buffer).
/// - price is in WAD (1e18). lastUpdate is a unix timestamp (seconds).
contract GuardedOracle is AccessControl {
    bytes32 public constant ORACLE_ADMIN = keccak256("ORACLE_ADMIN");

    struct PriceData {
        uint256 price;      // WAD
        uint64  updatedAt;  // seconds
    }

    // ---- Config
    uint256 public maxStale;     // seconds (0 => no staleness check)
    uint256 public minPrice;     // WAD (0 => no min bound)
    uint256 public maxPrice;     // WAD (0 => no max bound)
    bool    public paused;

    // ---- TWAP (optional)
    uint256 public twapWindow;   // seconds (0 => TWAP off)
    uint8   public constant TWAP_SIZE = 16;

    struct Point { uint256 p; uint64 t; }
    mapping(address => Point[TWAP_SIZE]) private _ring;
    mapping(address => uint8) private _idx;
    mapping(address => uint8) private _count;

    mapping(address => PriceData) public latest; // raw spot

    event SetBounds(uint256 minPrice, uint256 maxPrice);
    event SetMaxStale(uint256 seconds_);
    event SetPaused(bool paused);
    event SetTwapWindow(uint256 seconds_);
    event PricePushed(address indexed asset, uint256 price, uint64 ts);

    constructor(uint256 _maxStale) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ADMIN, msg.sender);
        maxStale = _maxStale;
    }

    // -------- Admin
    function setBounds(uint256 minP, uint256 maxP) external onlyRole(ORACLE_ADMIN) {
        minPrice = minP; maxPrice = maxP; emit SetBounds(minP, maxP);
    }

    function setMaxStale(uint256 s) external onlyRole(ORACLE_ADMIN) {
        maxStale = s; emit SetMaxStale(s);
    }

    function setPaused(bool p) external onlyRole(ORACLE_ADMIN) {
        paused = p; emit SetPaused(p);
    }

    function setTwapWindow(uint256 seconds_) external onlyRole(ORACLE_ADMIN) {
        twapWindow = seconds_; emit SetTwapWindow(seconds_);
    }

    // Push a new point (used in tests or by a feeder)
    function pushPrice(address asset, uint256 price) external onlyRole(ORACLE_ADMIN) {
        _push(asset, price, uint64(block.timestamp));
    }

    // Testing helper: allow custom timestamp (useful for staleness tests)
    function pushPriceAt(address asset, uint256 price, uint64 ts) external onlyRole(ORACLE_ADMIN) {
        _push(asset, price, ts);
    }

    function _push(address asset, uint256 price, uint64 ts) internal {
        latest[asset] = PriceData({price: price, updatedAt: ts});

        uint8 i = _idx[asset];
        _ring[asset][i] = Point({p: price, t: ts});
        _idx[asset] = (i + 1) % TWAP_SIZE;
        if (_count[asset] < TWAP_SIZE) _count[asset]++;

        emit PricePushed(asset, price, ts);
    }

    /// @notice Returns (price, lastUpdate). Applies paused/stale/bounds checks.
    /// If twapWindow>0, returns TWAP over points inside the window; else spot.
    function getPrice(address asset) external view returns (uint256 price, uint256 lastUpdate) {
        if (paused) revert("OraclePaused");

        PriceData memory d = latest[asset];
        price = d.price;
        lastUpdate = d.updatedAt;

        if (maxStale > 0 && block.timestamp - lastUpdate > maxStale) revert("StalePrice");
        if (minPrice > 0 && price < minPrice) revert("PriceBelowMin");
        if (maxPrice > 0 && price > maxPrice) revert("PriceAboveMax");

        if (twapWindow == 0) return (price, lastUpdate);

        // TWAP over points within window (simple average)
        uint256 from = block.timestamp - twapWindow;
        uint256 sum;
        uint256 n;
        uint8 count = _count[asset];
        for (uint8 k = 0; k < count; k++) {
            Point memory pt = _ring[asset][k];
            if (pt.t >= from) { sum += pt.p; n++; lastUpdate = pt.t > lastUpdate ? pt.t : lastUpdate; }
        }
        if (n == 0) return (price, lastUpdate); // fallback to spot if no points in window
        return (sum / n, lastUpdate);
    }
}
