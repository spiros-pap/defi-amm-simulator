// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal oracle base with staleness + pause hook.
abstract contract PriceOracle {
    error StalePrice();
    error OraclePaused();

    uint256 public staleAfter; // seconds
    bool public paused;

    event SetStaleAfter(uint256 seconds_);
    event SetPaused(bool paused);

    constructor(uint256 _staleAfter) {
        staleAfter = _staleAfter;
    }

    function setStaleAfter(uint256 s) external virtual {
        staleAfter = s;
        emit SetStaleAfter(s);
    }

    function setPaused(bool p) external virtual {
        paused = p;
        emit SetPaused(p);
    }

    function latestPrice() public view returns (uint256 price, uint256 updatedAt) {
        (price, updatedAt) = _latestPrice();
        if (paused) revert OraclePaused();
        if (block.timestamp - updatedAt > staleAfter) revert StalePrice();
    }

    function _latestPrice() internal view virtual returns (uint256 price, uint256 updatedAt);
}
