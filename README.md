# Stablecoin Protocol# Stablecoin Protocol



Educational DeFi project implementing a multi-collateral stablecoin with MEV-resistant liquidations.Educational DeFi project implementing a multi-collateral stablecoin with MEV-resistant liquidations.



⚠️ **Learning project - NOT for production**⚠️ **Learning project - NOT for production**



## What it demonstrates## What it demonstrates



- Multi-collateral vault management  - Multi-collateral vault management  

- MEV-resistant liquidation auctions (commit-reveal)- MEV-resistant liquidation auctions (commit-reveal)

- Stability pool mechanics- Stability pool mechanics

- Oracle integration with safety checks- Oracle integration with safety checks

- Emergency pause mechanisms- Emergency pause mechanisms



## Quick Start## Quick Start



```bash```bash

npm installnpm install

npm run compile  npm run compile  

npm testnpm test

``````



## Architecture## Architecture



See [docs/Architecture.md](docs/Architecture.md) for detailed diagrams and system design.See [docs/Architecture.md](docs/Architecture.md) for detailed diagrams and system design.



**Core contracts:****Core contracts:**

- `VaultManager` - CDP management- `VaultManager` - CDP management

- `LiquidationEngine` - Commit-reveal auctions  - `LiquidationEngine` - Commit-reveal auctions  

- `StabilityPool` - Liquidation backstop- `StabilityPool` - Liquidation backstop

- `GuardedOracle` - Price feeds with guards- `GuardedOracle` - Price feeds with guards

- Adapters for ERC4626 and rebasing tokens- Adapters for ERC4626 and rebasing tokens



## Requirements## Requirements



Node.js v18+ • Basic Solidity knowledgeNode.js v18+ • Basic Solidity knowledge



## License## License



MIT - Spiros PapagiannopoulosMIT - Spiros Papagiannopoulos
```

### Core Contracts

- **Stablecoin.sol** - ERC20 stablecoin token with role-based minting controls
- **VaultManager.sol** - Manages user vaults (CDPs) and collateral positions  
- **LiquidationEngine.sol** - MEV-resistant commit-reveal batch auction system
- **StabilityPool.sol** - Provides liquidation liquidity and stability mechanisms
- **PriceOracle.sol** - Secure price feeds with validation and circuit breakers

### Collateral Adapters

- **ERC4626Adapter.sol** - Supports ERC4626 vault tokens (wstETH, rETH, etc.)
- **RebasingAdapter.sol** - Handles rebasing tokens (stETH, etc.)

### Supporting Contracts

- **GuardedOracle.sol** - Oracle with additional safety mechanisms and circuit breakers
- **WadMath.sol** - Mathematical library for precise decimal operations

👉 **Detailed Architecture**: See [Architecture.md](docs/Architecture.md) for complete system design, data flow diagrams, and module relationships.

## 📊 Modules at a Glance

| Contract | Primary Responsibility | Critical Parameters | External Dependencies |
|----------|----------------------|-------------------|---------------------|
| **Stablecoin** | ERC20 token with controlled minting | Minter roles, supply cap | OpenZeppelin AccessControl |
| **VaultManager** | CDP management and health checks | LTV ratios, liquidation thresholds | PriceOracle, Adapters |
| **LiquidationEngine** | MEV-resistant auction system | Commit/reveal windows, bond requirements | VaultManager, StabilityPool |
| **StabilityPool** | Liquidation backstop liquidity | Reward rates, withdrawal limits | Stablecoin, VaultManager |
| **PriceOracle** | Secure price feeds with guards | Staleness limits, deviation bounds | Chainlink, TWAP sources |
| **ERC4626Adapter** | Yield-bearing vault integration | Share conversion, slippage limits | Target ERC4626 vaults |
| **RebasingAdapter** | Rebasing token normalization | Rebase index, share accounting | Target rebasing tokens |

## ✨ Key Features

- **Multi-Collateral Support** - Accept various collateral types through adapters
- **Liquidation Protection** - Commit-reveal auction system prevents MEV
- **Stability Mechanisms** - Automatic rebalancing and stability pool
- **Oracle Security** - Multiple validation layers and circuit breakers
- **Emergency Controls** - Pause mechanisms and emergency shutdown
- **Gas Optimization** - Efficient batch operations and storage patterns

## 🛡️ MEV-Resistant Liquidations

Traditional liquidation mechanisms suffer from front-running, sandwich attacks, and unfair price extraction. Our **commit-reveal batch auction system** solves these problems:

### Three-Phase Process
1. **Commit Phase (10min)**: Liquidators submit encrypted bid commitments with ETH bonds
2. **Reveal Phase (5min)**: Bidders reveal actual bids, invalid reveals forfeit bonds  
3. **Settlement**: Uniform clearing price ensures fair execution for all participants

### MEV Protection Features
- **Hidden bid information** prevents front-running during commit phase
- **Uniform pricing** eliminates bid shading and last-block manipulation
- **Batch processing** reduces per-vault costs and manipulation surface area

👉 **Learn more**: [Liquidation System Documentation](docs/Liquidations.md) | [ADR-01: Mechanism Selection](docs/ADR-01-liquidation.md)

## 🔒 Security Measures

- **Reentrancy Protection**: OpenZeppelin ReentrancyGuard on all external functions
- **Oracle Security**: Multi-source feeds with staleness checks and deviation bounds  
- **Flash Loan Resistance**: Multi-block operations and commit-reveal timing
- **Access Controls**: Role-based permissions with timelock governance
- **Emergency Systems**: Circuit breakers and pause mechanisms for crisis response

👉 **Learn more**: [Threat Model](docs/threat-model.md) | [Security Architecture](docs/Architecture.md#security-architecture)

## 🚀 Quick Start

### Prerequisites

 Node.js v18.x, v20.x, or v22.x (LTS recommended)
 npm (comes with Node.js)
 Git for version control

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd stablecoin-protocol

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
```

### Compilation

```bash
# Compile all contracts
npm run compile

# Check contract sizes
npm run size-contracts
```

### Testing

```bash
# Run all tests (use minimal config for Hardhat v3 compatibility)
npx hardhat test --config hardhat.config.minimal.ts

# Or use npm scripts (may require minimal config)
npm test

# Run specific test categories
npm run test:adapters     # Adapter functionality
npm run test:vault        # Vault management
npm run test:liquidation  # Liquidation mechanisms
npm run test:security     # Security and access controls
npm run test:integration  # Full integration tests

# Coverage and gas reporting are temporarily disabled due to Hardhat v3 incompatibility.
```

## 📦 Deployment Guide

This project uses **hardhat-deploy** for production deployments with proper dependency management and verification.

### Environment Setup

```bash
# Copy and configure environment variables
cp .env.example .env

# Required variables:
# SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
# PRIVATE_KEY=0x... (deployer private key)
# COINMARKETCAP_API_KEY=... (for gas reporting)
```

### Local Development

```bash
# Start local Hardhat node (Terminal 1)
npm run node

# Deploy to local network (Terminal 2)
npm run deploy:hardhat

# Verify deployment worked
npm run verify-deployment:hardhat
```

### Testnet Deployment

```bash
# Deploy to Sepolia testnet
npm run deploy:sepolia

# Verify deployment and configuration
npm run verify-deployment:sepolia
```

### Post-Deployment Configuration

```bash
# Configure risk parameters and collateral settings
npm run configure

# Run comprehensive protocol validation
npm run validate-deployment
```

## 🧪 Simulation Walkthrough

Run the complete liquidation simulation to see the commit-reveal auction system in action:

```bash
npm run simulate
```

**Sample Output:**
```
🎯 Starting Liquidation Simulation
================================

📋 Setup Phase:
✅ Deployed mock collateral (wstETH)
✅ Configured price oracle ($2000/ETH)
✅ User deposited 10 ETH, borrowed 15000 USDC

💥 Market Crash Simulation:
📉 ETH price dropped to $1500 (75% of original)
⚠️  Vault health: 0.75 (below 0.80 threshold)
🚨 Vault marked for liquidation

⏰ Commit-Reveal Auction:
🔒 Commit Phase: 3 liquidators submitted encrypted bids
🔓 Reveal Phase: All bids revealed successfully
💰 Clearing Price: $1470 (2% discount from market)
✅ Liquidation completed, vault closed

📊 Results:
- Liquidated: 10 ETH at $1470 = 14,700 USDC
- Protocol fee: 735 USDC (5%)
- Liquidator profit: 300 USDC (2% discount)
- Debt repaid: 14,700 USDC
```

**Note:** This repo uses hardhat-deploy for production deployments. Previous ignition modules are archived under `/examples/ignition` for reference.

## 🛠️ Development Workflow

### Branch Structure

- `main` - Production-ready code
- `staging` - Pre-production testing 
- `develop` - Integration branch for features
- `feature/*` - Feature development branches
- `hotfix/*` - Critical production fixes

### Development Commands

```bash
# Linting and formatting
npm run lint              # Check code style
npm run lint:fix          # Auto-fix linting issues
npm run format            # Format code with Prettier

# Type checking
npm run typecheck         # TypeScript compilation check

# Documentation
npm run docs              # Generate documentation
npm run docs:serve        # Serve docs locally
```

## 📋 Testing Strategy

### Unit Tests
- **Adapters** (`test/Adapters.*.test.ts`) - Collateral adapter functionality
- **Oracle** (`test/Oracle.*.test.ts`) - Price feed validation and security
- **Vault** (`test/Vault.*.test.ts`) - Vault management and flows
- **Liquidation** (`test/Liquidation.*.test.ts`) - Auction mechanisms

### Integration Tests  
- **Full Integration** (`test/full-integration.ts`) - End-to-end workflows
- **Security** (`test/Security.*.test.ts`) - Access controls and emergency procedures

### Performance Tests
- **Gas Benchmarks** (`test/Gas.benchmarks.test.ts`) - Gas usage optimization
- **Stress Tests** - High-load scenarios and edge cases

## 🔒 Security Features

### Access Control
- Role-based permissions with OpenZeppelin AccessControl
- Multi-signature requirements for critical operations
- Time-locked parameter changes

### Emergency Procedures
- Circuit breakers for rapid price movements
- Emergency pause functionality
- Liquidation protection mechanisms
- Oracle validation and fallbacks

### Audit Preparation
- Comprehensive test coverage (>95%)
- Static analysis with Slither
- Formal verification for critical functions
- Documentation of all assumptions and invariants

## 🔧 Configuration

### Environment Variables

Create a `.env` file with:

```bash
# Network RPCs
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR-API-KEY
MAINNET_RPC_URL=https://mainnet.infura.io/v3/YOUR-API-KEY

# Deployment Keys
DEPLOYER_PRIVATE_KEY=0x...
ADMIN_PRIVATE_KEY=0x...

# Oracle Configuration
CHAINLINK_ETH_USD=0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419
CHAINLINK_STETH_USD=0x...

# Protocol Parameters
LIQUIDATION_THRESHOLD=80  # 80% LTV
STABILITY_FEE=200        # 2% annual
LIQUIDATION_PENALTY=500   # 5% penalty
```

### Network Configuration
## ⚙️ Requirements

**Node.js:** v18, v20, or v22 (see `package.json` engines)
**Hardhat:** v3.x

> **Troubleshooting:**
> - Hardhat v3.x is not compatible with `hardhat-gas-reporter`. Gas reporting is disabled; use coverage tools instead.
> - If you encounter deep import errors, ensure all scripts use only public Hardhat APIs and update dependencies.

The project supports multiple networks:

- **hardhat** - Local development
- **localhost** - Local node  
- **sepolia** - Ethereum testnet
- **mainnet** - Ethereum mainnet (production)

### Deployment Tags

Use hardhat-deploy tags for selective deployment:

```bash
# Deploy only core contracts
npx hardhat deploy --tags core

# Deploy adapters only
npx hardhat deploy --tags adapters

# Full deployment
npx hardhat deploy --tags all
```

## 📊 Protocol Economics

### Collateral Types

| Asset | Max LTV | Liquidation Threshold | Stability Fee | Adapter |
|-------|---------|----------------------|---------------|---------|
| wstETH | 85% | 80% | 2.0% | ERC4626Adapter |
| stETH | 80% | 75% | 2.5% | RebasingAdapter |
| rETH | 85% | 80% | 2.0% | ERC4626Adapter |

### Liquidation Parameters

- **Commit Window**: 10 minutes (600 seconds)
- **Reveal Window**: 5 minutes (300 seconds)  
- **Minimum Bid**: 0.1 ETH
- **Bond Requirement**: 0.05 ETH per bid
- **Liquidation Penalty**: 5%
- **Liquidator Reward**: 1%

### Risk Parameters

- **Global Debt Ceiling**: 100M stablecoin
- **Min Collateral**: 1 ETH per vault
- **Oracle Timeout**: 1 hour
- **Max Price Deviation**: 10%

## 🏛️ Governance

### Parameter Updates

Critical parameters are controlled by governance:

- Collateral risk parameters (LTV, liquidation thresholds)
- Stability fees and liquidation penalties  
- Oracle configuration and timeouts
- Emergency pause/unpause decisions

### Timelock

- **Proposal Threshold**: 100k governance tokens
- **Voting Period**: 3 days
- **Timelock Delay**: 3 days
- **Quorum**: 10% of total supply

## 🔍 Monitoring & Analytics

### Key Metrics

Monitor these metrics for protocol health:

- **Total Value Locked (TVL)** - Sum of all collateral deposits
- **Collateralization Ratio** - Protocol-wide collateral/debt ratio
- **Liquidation Volume** - Daily/weekly liquidation activity
- **Stability Pool Size** - Available liquidation liquidity
- **Oracle Price Deviation** - Price feed accuracy and consistency

### Dashboards

- **Protocol Overview** - TVL, collateralization, key metrics
- **Vault Health** - Individual vault monitoring
- **Liquidation Activity** - Auction results and efficiency
- **Risk Metrics** - System health and stability indicators

## 🚨 Emergency Procedures

### Circuit Breakers

The protocol includes several automated safety mechanisms:

1. **Price Movement Limits** - Reject oracle updates >10% deviation
2. **Liquidation Volume Caps** - Pause if liquidations exceed thresholds  
3. **Gas Price Protection** - Limit operations during high gas periods
4. **Oracle Staleness** - Pause if price feeds become stale

### Manual Interventions

Authorized roles can trigger emergency procedures:

- **Emergency Pause** - Halt all user operations
- **Partial Shutdown** - Disable specific features
- **Oracle Override** - Bypass circuit breakers if needed
- **Liquidation Halt** - Stop liquidations during critical issues

## 🚀 Future Work

### Planned Features
- **Multi-chain Deployment**: Expand to L2s (Arbitrum, Optimism, Polygon)
- **Additional Collateral Types**: Real-world assets, synthetic tokens
- **Advanced Liquidation Mechanisms**: Dutch auctions, AMM integration  
- **Governance Token**: Decentralized parameter management and fee distribution
- **Insurance Integration**: Protocol-owned insurance and external coverage

### Optimization Opportunities  
- **Gas Efficiency**: Further optimize batch operations and storage patterns
- **MEV Capture**: Protocol-owned MEV extraction for treasury funding
- **Yield Strategies**: Advanced collateral deployment and yield farming
- **Cross-Protocol Integration**: Composability with other DeFi protocols

### Research Areas
- **Formal Verification**: Mathematical proofs for liquidation mechanisms
- **Economic Modeling**: Optimal parameter selection and stress testing
- **Layer 2 Scaling**: Cross-chain liquidation and state synchronization

## 📖 Additional Documentation

- [Architecture Guide](docs/Architecture.md) - Detailed system design
- [Liquidation Guide](docs/Liquidations.md) - How liquidations work
- [Threat Model](docs/threat-model.md) - Security considerations
- [ADR-01](docs/ADR-01-liquidation.md) - Liquidation design decisions

## 🤝 Contributing

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Run the test suite: `npm test`
5. Submit a pull request

### Code Standards

- Follow the existing code style and conventions
- Add comprehensive tests for new functionality
- Update documentation for user-facing changes
- Ensure gas optimizations don't compromise security

### Pull Request Process

1. Update README.md with details of interface changes
2. Update version numbers following SemVer
3. The PR will be merged once all checks pass and reviews are approved

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimers

- This software is experimental and provided "as-is"
- No guarantees are made about security or functionality
- Always perform independent security audits before mainnet deployment
- Users are responsible for understanding the risks of DeFi protocols

## 🔗 Links

- [Hardhat Documentation](https://hardhat.org/docs)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)
- [EIP-4626 Vault Standard](https://eips.ethereum.org/EIPS/eip-4626)
- [Chainlink Price Feeds](https://docs.chain.link/data-feeds)

---

**Built with ❤️ using Hardhat 3, OpenZeppelin, and battle-tested DeFi patterns** 🛠️
