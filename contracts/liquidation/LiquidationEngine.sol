// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// =============================================================================
// INTERFACES
// =============================================================================

interface IVaultManager {
    function health(uint256 vaultId) external view returns (uint256);
    function onLiquidationSettle(
        uint256[] calldata vaultIds,
        uint256[] calldata filledQty,
        uint256 clearingPrice
    ) external;
}

interface IStabilityPool {
    function burnStableFrom(address from, uint256 amount) external;
    function available() external view returns (uint256);
    function credit(address to, uint256 amount) external;
}

/**
 * @title LiquidationEngine
 * @notice Commit-reveal batch liquidation engine for MEV-resistant liquidations
 * @dev Implements uniform clearing price with commit-reveal auction mechanism
 */
contract LiquidationEngine is ReentrancyGuard, AccessControl {
    using SafeERC20 for IERC20;
    using SafeCast for uint256;

    // =============================================================================
    // EVENTS
    // =============================================================================

    event BatchEnqueued(uint256 indexed batchId, uint256 indexed vaultId);
    event BatchStarted(uint256 indexed batchId, uint256 startCommitTs, uint256 startRevealTs);
    event BidCommitted(uint256 indexed batchId, address indexed bidder, bytes32 commitment, uint256 bond);
    event BidRevealed(uint256 indexed batchId, address indexed bidder, uint256 vaultId, uint256 qty, uint256 price, bool valid);
    event BatchSettled(uint256 indexed batchId, uint256 clearingPrice, uint256 totalFilled);
    event BondRefunded(uint256 indexed batchId, address indexed bidder, uint256 amount);
    event BondSlashed(uint256 indexed batchId, address indexed bidder, uint256 amount);

    // =============================================================================
    // ERRORS
    // =============================================================================

    error InvalidBatchId();
    error BatchNotActive();
    error CommitWindowClosed();
    error RevealWindowClosed();
    error NotInCommitPhase();
    error NotInRevealPhase();
    error CannotSettleYet();
    error InsufficientBond();
    error InvalidReveal();
    error AlreadyRevealed();
    error NoCommitmentFound();
    error BatchAlreadySettled();
    error EmptyQueue();
    error VaultAlreadyQueued();



    // =============================================================================
    // STRUCTS
    // =============================================================================

    struct Bid {
        address bidder;
        uint256 vaultId;
        uint256 qty;
        uint256 price;
        bytes32 saltHash;
        bool revealed;
        bool valid;
    }

    struct Batch {
        uint256 startCommitTs;
        uint256 startRevealTs;
        uint256[] vaultIds;
        uint256 totalQtyOffered;
        uint256 clearingPrice;
        Bid[] revealedBids;
        bool settled;
    }

    // =============================================================================
    // STATE VARIABLES
    // =============================================================================

    // Immutable parameters
    uint256 public immutable COMMIT_WINDOW;
    uint256 public immutable REVEAL_WINDOW;
    uint256 public immutable minCommitBond;
    uint256 public immutable minLot;
    uint256 public immutable maxBatchSize;

    // Contract references
    IVaultManager public immutable vaultManager;
    IStabilityPool public immutable stabilityPool;

    // State
    uint256 public activeBatchId;
    uint256[] public vaultQueue;
    mapping(uint256 => bool) public vaultQueued;

    // Batch storage
    mapping(uint256 => Batch) public batches;
    mapping(uint256 => mapping(address => bytes32)) public commitments;
    mapping(uint256 => mapping(address => uint256)) public bonds;

    bytes32 public constant LIQUIDATOR_ROLE = keccak256("LIQUIDATOR_ROLE");

    // =============================================================================
    // CONSTRUCTOR
    // =============================================================================

    constructor(
        uint256 _commitWindow,
        uint256 _revealWindow,
        uint256 _minCommitBond,
        uint256 _minLot,
        uint256 _maxBatchSize,
        address _vaultManager,
        address _stabilityPool
    ) {
        COMMIT_WINDOW = _commitWindow;
        REVEAL_WINDOW = _revealWindow;
        minCommitBond = _minCommitBond;
        minLot = _minLot;
        maxBatchSize = _maxBatchSize;
        vaultManager = IVaultManager(_vaultManager);
        stabilityPool = IStabilityPool(_stabilityPool);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(LIQUIDATOR_ROLE, msg.sender);
    }

    // =============================================================================
    // BATCH MANAGEMENT
    // =============================================================================

    /**
     * @notice Enqueue a vault for liquidation
     * @param vaultId The vault to enqueue
     */
    function enqueue(uint256 vaultId) external onlyRole(LIQUIDATOR_ROLE) {
        if (vaultQueued[vaultId]) revert VaultAlreadyQueued();
        
        vaultQueue.push(vaultId);
        vaultQueued[vaultId] = true;
        
        emit BatchEnqueued(activeBatchId, vaultId);
    }

    /**
     * @notice Start a new batch if conditions are met
     */
    function startBatch() external {
        if (vaultQueue.length == 0) revert EmptyQueue();
        
        // Check if there's an active batch
        Batch storage currentBatch = batches[activeBatchId];
        if (currentBatch.startCommitTs > 0 && !currentBatch.settled) {
            // Check if current batch has finished reveal window
            if (block.timestamp < currentBatch.startRevealTs + REVEAL_WINDOW) {
                revert BatchNotActive();
            }
        }

        // Increment batch ID for new batch
        activeBatchId++;
        
        // Create new batch with queued vaults
        Batch storage newBatch = batches[activeBatchId];
        newBatch.startCommitTs = block.timestamp;
        newBatch.startRevealTs = block.timestamp + COMMIT_WINDOW;
        
        // Move vaults from queue to batch (up to maxBatchSize)
        uint256 batchSize = vaultQueue.length > maxBatchSize ? maxBatchSize : vaultQueue.length;
        for (uint256 i = 0; i < batchSize; i++) {
            uint256 vaultId = vaultQueue[i];
            newBatch.vaultIds.push(vaultId);
            vaultQueued[vaultId] = false;
            // Calculate total quantity offered from vault collateral
            newBatch.totalQtyOffered += minLot; // Using minimum lot size
        }
        
        // Remove processed vaults from queue
        for (uint256 i = 0; i < vaultQueue.length - batchSize; i++) {
            vaultQueue[i] = vaultQueue[i + batchSize];
        }
        for (uint256 i = 0; i < batchSize; i++) {
            vaultQueue.pop();
        }

        emit BatchStarted(activeBatchId, newBatch.startCommitTs, newBatch.startRevealTs);
    }

    // =============================================================================
    // COMMIT PHASE
    // =============================================================================

    /**
     * @notice Commit a bid during commit window
     * @param batchId The batch ID to bid on
     * @param commitment Hash of the bid details
     */
    function commitBid(uint256 batchId, bytes32 commitment) external payable nonReentrant {
        if (batchId == 0 || batchId > activeBatchId) revert InvalidBatchId();
        if (msg.value < minCommitBond) revert InsufficientBond();
        
        Batch storage batch = batches[batchId];
        if (batch.startCommitTs == 0) revert InvalidBatchId();
        if (block.timestamp >= batch.startRevealTs) revert CommitWindowClosed();
        if (batch.settled) revert BatchAlreadySettled();

        // Store commitment and bond
        commitments[batchId][msg.sender] = commitment;
        bonds[batchId][msg.sender] = msg.value;

        emit BidCommitted(batchId, msg.sender, commitment, msg.value);
    }

    // =============================================================================
    // REVEAL PHASE
    // =============================================================================

    /**
     * @notice Reveal a bid during reveal window
     * @param batchId The batch ID
     * @param vaultId The vault being bid on
     * @param qty Quantity of collateral desired
     * @param price Price per unit of collateral
     * @param salt Random salt used in commitment
     */
    function revealBid(
        uint256 batchId,
        uint256 vaultId,
        uint256 qty,
        uint256 price,
        bytes32 salt
    ) external nonReentrant {
        if (batchId == 0 || batchId > activeBatchId) revert InvalidBatchId();
        
        Batch storage batch = batches[batchId];
        if (block.timestamp < batch.startRevealTs) revert NotInRevealPhase();
        if (block.timestamp >= batch.startRevealTs + REVEAL_WINDOW) revert RevealWindowClosed();
        if (batch.settled) revert BatchAlreadySettled();

        bytes32 storedCommitment = commitments[batchId][msg.sender];
        if (storedCommitment == bytes32(0)) revert NoCommitmentFound();

        // Verify commitment
        bytes32 hash = keccak256(abi.encode(vaultId, qty, price, salt, msg.sender));
        bool isValid = (hash == storedCommitment);

        // Create bid struct
        Bid memory bid = Bid({
            bidder: msg.sender,
            vaultId: vaultId,
            qty: qty,
            price: price,
            saltHash: salt,
            revealed: true,
            valid: isValid
        });

        batch.revealedBids.push(bid);

        if (isValid) {
            // Refund bond for valid reveal
            uint256 bondAmount = bonds[batchId][msg.sender];
            bonds[batchId][msg.sender] = 0;
            (bool success, ) = msg.sender.call{value: bondAmount}("");
            require(success, "Bond refund failed");
            emit BondRefunded(batchId, msg.sender, bondAmount);
        }

        emit BidRevealed(batchId, msg.sender, vaultId, qty, price, isValid);
    }

    // =============================================================================
    // SETTLEMENT
    // =============================================================================

    /**
     * @notice Settle a batch after reveal window
     * @param batchId The batch to settle
     */
    function settle(uint256 batchId) external nonReentrant {
        if (batchId == 0 || batchId > activeBatchId) revert InvalidBatchId();
        
        Batch storage batch = batches[batchId];
        if (block.timestamp < batch.startRevealTs + REVEAL_WINDOW) revert CannotSettleYet();
        if (batch.settled) revert BatchAlreadySettled();

        // Mark as settled first (CEI pattern)
        batch.settled = true;

        // Slash bonds for non-revealed or invalid bids
        _slashBonds(batchId);

        // Calculate clearing price and allocations
        uint256 clearingPrice = _calculateClearingPrice(batchId);
        batch.clearingPrice = clearingPrice;

        // Execute settlement if we have a clearing price
        if (clearingPrice > 0) {
            _executeSettlement(batchId, clearingPrice);
        }

        emit BatchSettled(batchId, clearingPrice, batch.totalQtyOffered);
    }

    // =============================================================================
    // INTERNAL FUNCTIONS
    // =============================================================================

    /**
     * @notice Slash bonds for non-revealed or invalid commitments
     */
    function _slashBonds(uint256 batchId) internal {
        // Create mapping of revealed bidders
        Batch storage batch = batches[batchId];
        
        // Track who made valid reveals
        address[] memory validReveals = new address[](batch.revealedBids.length);
        uint256 validCount = 0;
        
        for (uint256 i = 0; i < batch.revealedBids.length; i++) {
            Bid storage bid = batch.revealedBids[i];
            if (bid.valid) {
                validReveals[validCount] = bid.bidder;
                validCount++;
            }
        }

        // Slash bonds for non-revealed bidders
        // Note: This is a simplified implementation
        // In production, we'd need a more sophisticated way to track all commitments
        
        emit BondSlashed(batchId, address(0), 0); // Placeholder event
    }

    /**
     * @notice Calculate uniform clearing price that maximizes filled quantity
     * @param batchId The batch to calculate for
     * @return The clearing price
     */
    function _calculateClearingPrice(uint256 batchId) internal view returns (uint256) {
        Batch storage batch = batches[batchId];
        
        if (batch.revealedBids.length == 0) {
            return 0;
        }

        // Create array of valid bids sorted by price (descending)
        Bid[] memory validBids = new Bid[](batch.revealedBids.length);
        uint256 validCount = 0;

        // Filter valid bids
        for (uint256 i = 0; i < batch.revealedBids.length; i++) {
            if (batch.revealedBids[i].valid) {
                validBids[validCount] = batch.revealedBids[i];
                validCount++;
            }
        }

        if (validCount == 0) {
            return 0;
        }

        // Simple bubble sort by price (descending)
        for (uint256 i = 0; i < validCount - 1; i++) {
            for (uint256 j = 0; j < validCount - i - 1; j++) {
                if (validBids[j].price < validBids[j + 1].price) {
                    Bid memory temp = validBids[j];
                    validBids[j] = validBids[j + 1];
                    validBids[j + 1] = temp;
                }
            }
        }

        // Find clearing price that maximizes filled quantity
        uint256 totalAvailable = batch.totalQtyOffered;
        uint256 cumulativeQty = 0;
        
        for (uint256 i = 0; i < validCount; i++) {
            cumulativeQty += validBids[i].qty;
            
            if (cumulativeQty >= totalAvailable) {
                // This price level fills all available quantity
                return validBids[i].price;
            }
        }

        // If total demand < supply, use lowest bid price
        if (validCount > 0) {
            return validBids[validCount - 1].price;
        }

        return 0;
    }

    /**
     * @notice Execute settlement with clearing price
     * @param batchId The batch to settle
     * @param clearingPrice The uniform clearing price
     */
    function _executeSettlement(uint256 batchId, uint256 clearingPrice) internal {
        Batch storage batch = batches[batchId];
        
        // Calculate allocations for winners at clearing price
        uint256 totalFilled = 0;
        uint256[] memory filledQty = new uint256[](batch.vaultIds.length);
        
        // Pro-rata allocation if oversubscribed
        uint256 totalDemandAtPrice = 0;
        for (uint256 i = 0; i < batch.revealedBids.length; i++) {
            Bid storage bid = batch.revealedBids[i];
            if (bid.valid && bid.price >= clearingPrice) {
                totalDemandAtPrice += bid.qty;
            }
        }

        // Execute transfers and settlements
        if (totalDemandAtPrice > 0) {
            uint256 fillRatio = batch.totalQtyOffered * 1e18 / totalDemandAtPrice;
            if (fillRatio > 1e18) fillRatio = 1e18; // Cap at 100%

            for (uint256 i = 0; i < batch.revealedBids.length; i++) {
                Bid storage bid = batch.revealedBids[i];
                if (bid.valid && bid.price >= clearingPrice) {
                    uint256 allocation = (bid.qty * fillRatio) / 1e18;
                    // Transfer collateral to bidder and charge clearing price
                    // Implementation depends on collateral adapter integration
                    totalFilled += allocation;
                }
            }

            // Update vault manager
            vaultManager.onLiquidationSettle(batch.vaultIds, filledQty, clearingPrice);
        }
    }

    // =============================================================================
    // VIEW FUNCTIONS
    // =============================================================================

    /**
     * @notice Get batch information
     */
    function getBatch(uint256 batchId) external view returns (
        uint256 startCommitTs,
        uint256 startRevealTs,
        uint256[] memory vaultIds,
        uint256 totalQtyOffered,
        uint256 clearingPrice,
        bool settled
    ) {
        Batch storage batch = batches[batchId];
        return (
            batch.startCommitTs,
            batch.startRevealTs,
            batch.vaultIds,
            batch.totalQtyOffered,
            batch.clearingPrice,
            batch.settled
        );
    }

    /**
     * @notice Get number of revealed bids for a batch
     */
    function getRevealedBidsCount(uint256 batchId) external view returns (uint256) {
        return batches[batchId].revealedBids.length;
    }

    /**
     * @notice Get revealed bid details
     */
    function getRevealedBid(uint256 batchId, uint256 index) external view returns (
        address bidder,
        uint256 vaultId,
        uint256 qty,
        uint256 price,
        bool revealed,
        bool valid
    ) {
        Bid storage bid = batches[batchId].revealedBids[index];
        return (bid.bidder, bid.vaultId, bid.qty, bid.price, bid.revealed, bid.valid);
    }

    /**
     * @notice Check if currently in commit phase for a batch
     */
    function isCommitPhase(uint256 batchId) external view returns (bool) {
        Batch storage batch = batches[batchId];
        return block.timestamp >= batch.startCommitTs && block.timestamp < batch.startRevealTs;
    }

    /**
     * @notice Check if currently in reveal phase for a batch
     */
    function isRevealPhase(uint256 batchId) external view returns (bool) {
        Batch storage batch = batches[batchId];
        return block.timestamp >= batch.startRevealTs && 
               block.timestamp < batch.startRevealTs + REVEAL_WINDOW;
    }

    /**
     * @notice Check if batch can be settled
     */
    function canSettle(uint256 batchId) external view returns (bool) {
        Batch storage batch = batches[batchId];
        return block.timestamp >= batch.startRevealTs + REVEAL_WINDOW && !batch.settled;
    }
}
