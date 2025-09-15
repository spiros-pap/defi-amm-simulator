# Liquidations.md

## Protocol Liquidation System: Commit-Reveal Batch Auctions

### Overview

The stablecoin protocol implements a MEV-resistant liquidation mechanism using commit-reveal batch auctions with uniform clearing prices. This design prevents front-running and price manipulation while ensuring efficient liquidation of under-collateralized positions.

## System Architecture

### Core Components

1. **LiquidationEngine**: Orchestrates the commit-reveal auction process
2. **VaultManager**: Manages vault health and integration with liquidation system
3. **StabilityPool**: Provides stable tokens for debt cancellation
4. **Oracle System**: Provides collateral price feeds for health calculations

### Integration Flow

```
Price Drop → Vault Health Check → Flagging → Batch Creation → Commit → Reveal → Settlement
```

## Protocol Phases

### Phase 1: Monitoring & Flagging

**Trigger Conditions:**
- Vault health ratio drops below Minimum Collateralization Ratio (MCR)
- Health = (Collateral Value × LTV) / Debt
- MCR typically set to 150% (1.5x)

**Flagging Process:**
```solidity
function flagForLiquidation(uint256 vaultId) external {
    require(health(vaultId) < MCR, "Vault still healthy");
    liquidationEngine.enqueue(vaultId);
}
```

### Phase 2: Batch Formation

**Batch Creation:**
- Triggered when vault queue is non-empty
- Batches up to `maxBatchSize` vaults
- Calculates total collateral available (`totalQtyOffered`)

**Timing:**
- `startCommitTs`: Batch creation timestamp
- `startRevealTs`: `startCommitTs + COMMIT_WINDOW`

### Phase 3: Commit Phase

**Duration:** `COMMIT_WINDOW` seconds (typically 300s = 5 minutes)

**Process:**
1. Liquidators submit commitment hashes with bonds
2. Commitment = `keccak256(abi.encode(vaultId, qty, price, salt, bidder))`
3. Bond requirement: `msg.value >= minCommitBond`

**Security Features:**
- Hidden bid parameters prevent last-block sniping
- Bond requirement prevents spam/griefing
- Time window enforcement prevents late commits

```solidity
function commitBid(uint256 batchId, bytes32 commitment) external payable {
    require(msg.value >= minCommitBond, "Insufficient bond");
    require(block.timestamp < batch.startRevealTs, "Commit window closed");
    
    commitments[batchId][msg.sender] = commitment;
    bonds[batchId][msg.sender] = msg.value;
}
```

### Phase 4: Reveal Phase

**Duration:** `REVEAL_WINDOW` seconds (typically 300s = 5 minutes)

**Process:**
1. Liquidators reveal bid parameters
2. System validates commitment hashes
3. Valid reveals trigger bond refunds
4. Invalid/missing reveals result in bond slashing

**Validation:**
```solidity
bytes32 hash = keccak256(abi.encode(vaultId, qty, price, salt, msg.sender));
bool isValid = (hash == storedCommitment);
```

### Phase 5: Settlement

**Timing:** After `REVEAL_WINDOW` ends

**Settlement Algorithm:**

1. **Clearing Price Calculation:**
   - Sort valid bids by price (descending)
   - Find uniform price that maximizes filled quantity
   - All winners pay the same clearing price

2. **Pro-rata Allocation:**
   - When demand > supply: proportional fills at clearing price
   - Fill ratio = `totalQtyOffered / totalDemandAtClearingPrice`
   - Individual fill = `bidQuantity × fillRatio`

3. **Execution:**
   - Transfer collateral to winning bidders
   - Burn debt from StabilityPool
   - Apply liquidation fees
   - Update vault states

## Settlement Math

### Uniform Clearing Price Formula

```
For sorted bids B₁, B₂, ..., Bₙ (price descending):
  Cumulative demand Dᵢ = Σⱼ₌₁ⁱ qty(Bⱼ)
  
  Clearing price = price(Bᵢ) where:
    Dᵢ₋₁ < totalQtyOffered ≤ Dᵢ
    
  If total demand < supply:
    Clearing price = lowest bid price
```

### Pro-rata Fill Calculation

```
fillRatio = min(1, totalQtyOffered / demandAtClearingPrice)
allocation(bidder) = bidQuantity × fillRatio
payment(bidder) = allocation × clearingPrice
```

### Example Scenario

**Available Collateral:** 10 ETH  
**Bids:**
- Bidder A: 6 ETH @ $1500/ETH
- Bidder B: 4 ETH @ $1450/ETH  
- Bidder C: 8 ETH @ $1400/ETH

**Settlement:**
- Total demand at $1400: 18 ETH
- Clearing price: $1400/ETH (fills all available supply)
- Fill ratio: 10/18 = 55.56%
- Allocations: A=3.33 ETH, B=2.22 ETH, C=4.44 ETH
- All pay $1400/ETH regardless of original bid price

## MEV Resistance Features

### 1. Hidden Information During Commit

**Problem:** Front-runners observe pending transactions and place better bids
**Solution:** Commitment hashes hide bid details until reveal phase

### 2. Uniform Pricing

**Problem:** Auction manipulation through strategic bidding
**Solution:** All winners pay the same clearing price, removing bid optimization incentives

### 3. Time Window Enforcement

**Problem:** Last-block bid submission for optimal pricing
**Solution:** Strict time windows prevent timing manipulation

### 4. Bond Requirements

**Problem:** Costless griefing through fake bids
**Solution:** Economic bonds create cost for non-serious participation

## Parameter Configuration

### Core Parameters

| Parameter | Recommended | Description |
|-----------|-------------|-------------|
| `COMMIT_WINDOW` | 300s (5 min) | Commit phase duration |
| `REVEAL_WINDOW` | 300s (5 min) | Reveal phase duration |
| `minCommitBond` | 0.1 ETH | Minimum bond for participation |
| `minLot` | 1.0 ETH | Minimum collateral lot size |
| `maxBatchSize` | 10 vaults | Maximum vaults per batch |

### Tuning Guidelines

**COMMIT_WINDOW:**
- Longer → More time for participation, higher gas costs
- Shorter → Faster liquidations, less participation
- Consider network congestion and block times

**REVEAL_WINDOW:**
- Must allow sufficient time for reveals
- Should account for network delays
- Balance speed vs. inclusion

**minCommitBond:**
- Higher → Fewer spam bids, may exclude small liquidators
- Lower → More participation, potential griefing
- Set based on gas costs and expected liquidation sizes

**Batch Parameters:**
- `maxBatchSize`: Balance gas costs vs. liquidation efficiency
- `minLot`: Prevent dust liquidations, ensure economic viability

## Gas Optimization Strategies

### 1. Batch Processing
- Group multiple vaults in single auction
- Amortize fixed costs across multiple liquidations

### 2. Efficient Data Structures
- Pack structs to minimize storage slots
- Use mappings for sparse data

### 3. Settlement Optimization
- Pre-calculate clearing price off-chain when possible
- Batch collateral transfers
- Minimize external calls

### 4. Bond Management
- Efficient refund/slashing logic
- Gas-optimal ETH transfers

## Security Considerations

### 1. Reentrancy Protection
- All external calls use `nonReentrant` modifier
- CEI pattern: Checks, Effects, Interactions

### 2. Access Control
- Role-based permissions for critical functions
- Multi-sig for parameter updates

### 3. Oracle Manipulation
- Price feeds from GuardedOracle with manipulation resistance
- Time-weighted average prices (TWAP) where appropriate

### 4. Economic Attacks
- Bond slashing prevents griefing
- Clearing price mechanism prevents extraction

## Monitoring & Analytics

### Key Metrics

1. **Liquidation Efficiency:**
   - Time from flagging to settlement
   - Participation rates (bids per batch)
   - Fill rates and price discovery

2. **MEV Resistance:**
   - Price deviation from external markets
   - Bid clustering analysis
   - Front-running detection

3. **System Health:**
   - Vault recovery rates post-liquidation
   - StabilityPool utilization
   - Gas cost trends

### Event Monitoring

```solidity
event BatchStarted(uint256 indexed batchId, uint256 startCommitTs, uint256 startRevealTs);
event BidCommitted(uint256 indexed batchId, address indexed bidder, bytes32 commitment, uint256 bond);
event BidRevealed(uint256 indexed batchId, address indexed bidder, uint256 vaultId, uint256 qty, uint256 price, bool valid);
event BatchSettled(uint256 indexed batchId, uint256 clearingPrice, uint256 totalFilled);
event BondSlashed(uint256 indexed batchId, address indexed bidder, uint256 amount);
```

## Upgrade Considerations

### 1. Parameter Updates
- Timelock for critical parameter changes
- Emergency pause functionality
- Gradual rollout for significant changes

### 2. Algorithm Improvements
- Modular clearing price calculation
- Extensible bid validation
- Pluggable settlement mechanisms

### 3. Integration Points
- Flexible adapter patterns for new collateral types
- Upgradeable StabilityPool interface
- Oracle system evolution

## Testing Strategy

### Unit Tests
- Commitment/reveal validation
- Clearing price calculations
- Bond management logic
- Window enforcement

### Integration Tests
- End-to-end liquidation flows
- Multi-vault scenarios
- Edge case handling

### Stress Tests
- High-participation batches
- Extreme price movements
- Gas limit scenarios

### MEV Simulation
- Front-running attempt modeling
- Sandwich attack resistance
- Price manipulation scenarios

## References

- [ADR-01: Liquidation Mechanism](./ADR-01-liquidation.md)
- [Architecture Overview](./Architecture.md)
- [Threat Model](./threat-model.md)
- [Gas Analysis](./gas.md)

---

*This documentation covers the production commit-reveal batch liquidation system. For technical implementation details, refer to the contract source code and comprehensive test suites.*