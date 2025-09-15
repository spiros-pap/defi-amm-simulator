# ADR-01: Liquidation Mechanism Selection - Commit-Reveal Batch Auction

## Status
**Implemented** - Production-ready commit-reveal batch auction system

## Context
The lending protocol requires a liquidation mechanism to handle undercollateralized positions while minimizing MEV (Maximal Extractable Value) extraction and ensuring fair price discovery. Traditional liquidation methods suffer from front-running, sandwich attacks, and unfair price execution.

## Decision
Implement a **Commit-Reveal Batch Auction** system for liquidations.

## Architecture Overview

### Phase Structure
1. **Commit Phase** (N blocks): Bidders submit sealed commitment hashes
2. **Reveal Phase** (N blocks): Bidders reveal their actual bids
3. **Settlement Phase**: Uniform price clearing and collateral distribution

### Key Components

#### Commitment Structure
```solidity
struct Commitment {
    bytes32 commitmentHash; // keccak256(vaultId, qty, price, salt, bidder)
    uint256 bond;           // Anti-griefing bond
    address bidder;
    uint256 blockCommitted;
}
```

#### Parameters
- `COMMIT_WINDOW`: 10 blocks (~2.5 minutes)
- `REVEAL_WINDOW`: 10 blocks (~2.5 minutes) 
- `minCommitBond`: 0.1 ETH equivalent
- `minLot`: $100 equivalent minimum bid
- `maxBatchSize`: 50 vaults per batch

### Liquidation Flow

#### 1. Batch Creation
- Anyone can trigger batch creation when position(s) fall below MCR
- Multiple unsafe vaults aggregated into single batch
- Reduces individual vault sniping

#### 2. Commit Phase (Blocks N to N+10)
```solidity
function commitBid(uint256 batchId, bytes32 commitmentHash) external payable {
    require(msg.value >= minCommitBond, "Insufficient bond");
    require(block.number <= batches[batchId].commitDeadline, "Commit phase ended");
    
    commitments[batchId][msg.sender] = Commitment({
        commitmentHash: commitmentHash,
        bond: msg.value,
        bidder: msg.sender,
        blockCommitted: block.number
    });
}
```

#### 3. Reveal Phase (Blocks N+10 to N+20)
```solidity
function revealBid(
    uint256 batchId,
    uint256 vaultId, 
    uint256 qty,
    uint256 price,
    uint256 salt
) external {
    bytes32 expectedHash = keccak256(abi.encodePacked(vaultId, qty, price, salt, msg.sender));
    require(expectedHash == commitments[batchId][msg.sender].commitmentHash, "Invalid reveal");
    
    // Store valid bid for settlement
    bids[batchId].push(Bid({
        bidder: msg.sender,
        vaultId: vaultId,
        quantity: qty,
        price: price
    }));
}
```

#### 4. Settlement Phase
- Uniform price clearing: all winning bids pay the same clearing price
- Pro-rata allocation if oversubscribed
- Collateral transferred to winners
- Debt burned using StabilityPool funds
- Liquidation fees distributed

### MEV Resistance Analysis

#### vs. First-Come-First-Served Auctions
| Attack Vector | FCFS Vulnerability | Commit-Reveal Protection |
|---------------|-------------------|------------------------|
| **Front-running** | ❌ Bots can see pending txs and outbid | ✅ Bids hidden during commit phase |
| **Sandwich attacks** | ❌ Can manipulate prices around liquidation | ✅ Uniform price clearing prevents manipulation |
| **Price sniping** | ❌ Best prices extracted immediately | ✅ Sealed bids prevent information leakage |
| **Gas wars** | ❌ Incentivizes high gas bidding wars | ✅ Time-based windows eliminate gas competition |

#### Specific Protections

1. **Sealed Bidding**: Prices hidden until reveal phase prevents copying strategies
2. **Uniform Price Clearing**: All winners pay same price reduces incentive to overbid  
3. **Batch Processing**: Multiple vaults in one auction reduces individual targeting
4. **Time Windows**: Fixed block windows prevent timing manipulation
5. **Anti-Griefing Bonds**: Minimum bonds with penalties for non-reveal prevent spam

### Trade-offs vs Dutch Auctions

#### Advantages of Commit-Reveal
- ✅ **MEV Resistance**: Hidden bids prevent front-running
- ✅ **Fair Price Discovery**: Uniform clearing price
- ✅ **Batch Efficiency**: Process multiple liquidations together
- ✅ **Griefing Protection**: Bonds prevent spam attacks

#### Disadvantages vs Dutch
- ❌ **Complexity**: More complex implementation and UX
- ❌ **Time Delay**: Requires 2-phase process (~5 minutes total)
- ❌ **Capital Efficiency**: Bonds lock up capital temporarily
- ❌ **Participation Barriers**: Requires understanding of commit-reveal

#### Why Not Dutch Auctions?
While Dutch auctions are simpler and provide immediate settlement, they suffer from:
- **Front-running**: Bots can see the declining price and snipe optimal moments
- **MEV Extraction**: Miners/validators can manipulate timing
- **Price Manipulation**: Large players can wait for favorable prices

## Implementation Strategy

### Phase 1: Core Mechanism
- Basic commit-reveal with single collateral type
- Manual batch creation
- Simple uniform price clearing

### Phase 2: Optimizations  
- Automated batch creation via keepers
- Multi-collateral batch support
- Gas-optimized storage patterns

### Phase 3: Advanced Features
- Dutch auction fallback for failed batches
- Dynamic parameter adjustment
- Cross-chain liquidation support

## Security Considerations

### Bond Slashing
- Non-revealing bidders forfeit their bonds
- Invalid reveals result in bond slashing
- Bonds distributed to successful bidders or protocol treasury

### Oracle Manipulation
- Price feeds must be stable during entire liquidation process
- TWAP windows protect against flash-loan price manipulation
- Circuit breakers pause system during extreme volatility

### Griefing Vectors
- **Commit spam**: Mitigated by minimum bond requirements
- **Reveal griefing**: Penalized through bond slashing
- **Batch stuffing**: Limited by maxBatchSize parameter

## Parameters & Tuning

### Time Windows
- **Short windows** (5-10 blocks): Faster liquidations, higher MEV risk
- **Long windows** (15-20 blocks): Better MEV protection, slower liquidations
- **Recommended**: 10 blocks each phase for balanced approach

### Bond Requirements
- **Low bonds**: More participation, higher griefing risk
- **High bonds**: Less griefing, reduced participation
- **Recommended**: 0.1 ETH equivalent (adjustable by governance)

## Future Considerations

### Hybrid Models
- Commit-reveal for large liquidations (>$10k)
- Dutch auctions for smaller liquidations (<$1k)
- Immediate liquidation for extreme under-collateralization

### Cross-Chain Integration
- Batch creation on L1, bidding on L2
- State synchronization challenges
- Gas cost optimization across chains

## Conclusion

The commit-reveal batch auction mechanism provides robust MEV resistance while maintaining efficient price discovery. The sealed bidding process and uniform price clearing create a fair liquidation environment that protects both borrowers and the protocol from value extraction.

The complexity trade-off is justified by the MEV protection benefits, especially for a protocol handling significant TVL where value extraction could undermine system stability.

## References

- [Flashboys 2.0: Frontrunning in Decentralized Exchanges](https://arxiv.org/abs/1904.05234)
- [MEV-Resistant Liquidations](https://github.com/euler-xyz/euler-contracts/blob/master/docs/liquidations.md)
- [Batch Auctions for Automated Market Makers](https://github.com/cowprotocol/contracts)