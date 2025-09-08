// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract LiquidationEngine {
    enum Phase {
        Idle,
        Commit,
        Reveal,
        Settle
    }
    Phase public phase;

    event PhaseChanged(Phase newPhase);
    event Commit(address indexed bidder, bytes32 commitment, uint256 bond);
    event Reveal(address indexed bidder, uint256 price, uint256 quantity);
    event Settled(uint256 clearingPrice);

    // placeholders for commit/reveal/settle logic
    function setPhase(Phase p) external {
        phase = p;
        emit PhaseChanged(p);
    }
}
