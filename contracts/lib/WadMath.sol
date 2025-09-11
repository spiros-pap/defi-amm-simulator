// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal 1e18 fixed-point math helpers.
library WadMath {
    uint256 internal constant WAD = 1e18;

    function mulWad(uint256 a, uint256 b) internal pure returns (uint256) {
        // (a * b) / 1e18 with rounding down
        return (a * b) / WAD;
    }

    function divWad(uint256 a, uint256 b) internal pure returns (uint256) {
        // (a * 1e18) / b with rounding down
        return (a * WAD) / b;
    }
}
