# Stablecoin Protocol

A decentralized stablecoin protocol built with Hardhat 3, featuring collateralized debt positions (CDPs), liquidation mechanisms, and a stability pool. This protocol enables users to mint stablecoins by depositing various types of collateral.

## 🏗️ Architecture Overview

The protocol consists of several interconnected smart contracts:

### Core Contracts

- **Stablecoin.sol** - ERC20 stablecoin token with minting/burning controls
- **VaultManager.sol** - Manages user vaults (CDPs) and collateral positions  
- **LiquidationEngine.sol** - Handles liquidations through commit-reveal auctions
- **StabilityPool.sol** - Provides liquidation liquidity and stability mechanisms
- **PriceOracle.sol** - Secure price feeds with validation and circuit breakers

### Collateral Adapters

- **ERC4626Adapter.sol** - Supports ERC4626 vault tokens (wstETH, rETH, etc.)
- **RebasingAdapter.sol** - Handles rebasing tokens (stETH, etc.)

### Supporting Contracts

- **GuardedOracle.sol** - Oracle with additional safety mechanisms
- **WadMath.sol** - Mathematical library for precise decimal operations

## ✨ Key Features

- **Multi-Collateral Support** - Accept various collateral types through adapters
- **Liquidation Protection** - Commit-reveal auction system prevents MEV
- **Stability Mechanisms** - Automatic rebalancing and stability pool
- **Oracle Security** - Multiple validation layers and circuit breakers
- **Emergency Controls** - Pause mechanisms and emergency shutdown
- **Gas Optimization** - Efficient batch operations and storage patterns

## 🚀 Quick Start

### Prerequisites

- Node.js v16+ and npm
- Git for version control

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
# Run all tests
npm test

# Run specific test categories
npm run test:adapters     # Adapter functionality
npm run test:vault        # Vault management
npm run test:liquidation  # Liquidation mechanisms
npm run test:security     # Security and access controls
npm run test:integration  # Full integration tests

# Run with gas reporting
npm run test:gas

# Generate coverage report
npm run coverage
```

## 📦 Deployment

### Local Development

```bash
# Start local Hardhat node
npm run node

# Deploy to local network
npm run deploy:hardhat

# Run simulation on local network
npm run simulate
```

### Testnet Deployment

```bash
# Deploy to Sepolia testnet
npm run deploy:sepolia

# Verify deployment
npm run verify-deployment:sepolia
```

### Production Configuration

```bash
# Configure protocol parameters
npm run configure

# Run comprehensive validation
npm run validate-deployment
```

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

**Built with Hardhat 3** 🛠️

After setting the variable, you can run the deployment with the Sepolia network:

```shell
npx hardhat ignition deploy --network sepolia ignition/modules/Counter.ts
```
