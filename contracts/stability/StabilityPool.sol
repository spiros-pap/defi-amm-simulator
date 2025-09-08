// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract StabilityPool {
    IERC20 public immutable stable;

    mapping(address => uint256) public depositOf;
    uint256 public totalDeposits;

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);

    constructor(IERC20 _stable) {
        stable = _stable;
    }

    function deposit(uint256 amount) external {
        depositOf[msg.sender] += amount;
        totalDeposits += amount;
        // stable.transferFrom(msg.sender, address(this), amount);
        emit Deposit(msg.sender, amount);
    }

    function withdraw(uint256 amount) external {
        require(depositOf[msg.sender] >= amount, "insufficient");
        depositOf[msg.sender] -= amount;
        totalDeposits -= amount;
        // stable.transfer(msg.sender, amount);
        emit Withdraw(msg.sender, amount);
    }
}
