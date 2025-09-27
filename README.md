# Multi-Collateral Stablecoin Protocol

Experimental implementation of a CDP-based stablecoin system with MEV-resistant liquidation mechanisms.

## Overview

Multi-collateral Collateralized Debt Position (CDP) protocol that issues stablecoins against deposited collateral. Users deposit assets (ERC4626 vaults, rebasing tokens) to mint stablecoins, with undercollateralized positions liquidated through commit-reveal auctions.

## Features

- **Implemented:**
  - Multi-collateral vault management with health monitoring
  - MEV-resistant commit-reveal liquidation auctions  
  - Stability pool for liquidation backstop
  - Oracle integration with price guards
  - Emergency pause mechanisms
  - Support for ERC4626 and rebasing token adapters

- **Planned:**
  - Advanced auction mechanisms
  - Governance token integration
  - Cross-chain collateral support

## Installation & Setup

```bash
# Install dependencies
npm install

# Compile contracts
npm run compile

# Deploy locally
npx hardhat node
npx hardhat run scripts/deploy.ts --network localhost

# Run tests
npm test
```

## Usage

```bash
# Open a vault (deposit collateral, mint stablecoins)
npx hardhat run scripts/simulate.ts --network localhost

# Example output:
# Vault opened: ID 1, Collateral: 10 ETH, Debt: 5000 STABLE
# Health factor: 2.0 (safe)
```

## Architecture

**Core Contracts:**
- `VaultManager` - CDP lifecycle management and health monitoring
- `LiquidationEngine` - Commit-reveal auction system for undercollateralized positions
- `StabilityPool` - Liquidity backstop for failed auctions
- `GuardedOracle` - Price feeds with circuit breakers
- `CollateralAdapters` - ERC4626 and rebasing token support

For detailed system design and component interactions, see [Architecture Documentation](docs/Architecture.md).

## Security Notice

⚠️ **EXPERIMENTAL - NOT PRODUCTION READY**

This is a learning project with known limitations:
- Mock components in critical paths
- Limited testing coverage
- No external audits
- Prototype-level security measures

Do not use with real funds.

## License

MIT - Spiros Papagiannopoulos
