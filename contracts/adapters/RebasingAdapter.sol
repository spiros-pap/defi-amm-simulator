// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20, IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {ICollateralAdapter} from "../interfaces/ICollateralAdapter.sol";
import {WadMath} from "../lib/WadMath.sol";

/// @notice Simple rebasing wrapper with synthetic index for testing.
contract RebasingAdapter is ICollateralAdapter {
    using WadMath for uint256;

    IERC20 public immutable token;       // underlying ERC20
    uint8  public immutable tokenDecimals;

    // index starts at 1e18; increasing index simulates positive rebase
    uint256 public index = 1e18;

    mapping(address => uint256) public sharesOf;
    uint256 public totalShares;

    event Deposited(address indexed from, address indexed receiver, uint256 assets, uint256 shares);
    event Withdrawn(address indexed owner, address indexed receiver, uint256 shares, uint256 assets);
    event IndexSet(uint256 newIndex);

    constructor(IERC20 _token) {
        token = _token;
        tokenDecimals = IERC20Metadata(address(_token)).decimals();
    }

    function setIndex(uint256 newIndex) external { // for tests
        index = newIndex;
        emit IndexSet(newIndex);
    }

    function asset() external view override returns (address) { return address(token); }
    function decimals() external view override returns (uint8) { return tokenDecimals; }

    function depositFrom(address from, uint256 assets, address receiver) external override returns (uint256 shares) {
        token.transferFrom(from, address(this), assets);
        shares = assets.divWad(index); // shares = assets / index
        sharesOf[receiver] += shares;
        totalShares += shares;
        emit Deposited(from, receiver, assets, shares);
    }

    function withdraw(uint256 shares, address receiver, address owner) external override returns (uint256 assets) {
        require(sharesOf[owner] >= shares, "insufficient shares");
        sharesOf[owner] -= shares;
        totalShares -= shares;
        assets = shares.mulWad(index); // assets = shares * index
        token.transfer(receiver, assets);
        emit Withdrawn(owner, receiver, shares, assets);
    }

    function valueOf(uint256 shares) external view override returns (uint256 assets) {
        return shares.mulWad(index);
    }
}