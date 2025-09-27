# Stablecoin Protocol

Educational DeFi project implementing a multi-collateral stablecoin with MEV-resistant liquidations.

⚠️ **Learning project - NOT for production**

## What it demonstrates

- Multi-collateral vault management  
- MEV-resistant liquidation auctions (commit-reveal)
- Stability pool mechanics
- Oracle integration with safety checks
- Emergency pause mechanisms

## Quick Start

```bash
npm install
npm run compile  
npm test
```

## Architecture

See [docs/Architecture.md](docs/Architecture.md) for detailed diagrams and system design.

**Core contracts:**
- `VaultManager` - CDP management
- `LiquidationEngine` - Commit-reveal auctions  
- `StabilityPool` - Liquidation backstop
- `GuardedOracle` - Price feeds with guards
- Adapters for ERC4626 and rebasing tokens

## Requirements

Node.js v18+ • Basic Solidity knowledge

## License

MIT - Spiros Papagiannopoulos
