# Contributing

This is a **personal educational project** for learning DeFi protocol development.

## Quick Setup

```bash
npm install
npm run compile
npm test
```

Feel free to:
- Open issues for bugs or questions
- Fork and experiment  
- Suggest improvements

## Development Notes

- Uses Hardhat for development
- Run `npm run compile` to build contracts
- Run `npm test` for basic testing

No formal contribution process - this is for learning! 🚀

4. **Run tests to ensure everything works**
   ```bash
   npm test
   ```

## 🛠️ Development Workflow

### Branch Naming Convention

- `feature/description` - New features
- `fix/description` - Bug fixes  
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring
- `test/description` - Test improvements

### Commit Message Format

Use the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Examples:**
```
feat(vault): add multi-collateral support
fix(liquidation): resolve bond slashing edge case
docs(readme): update deployment instructions
test(oracle): add price deviation test cases
```

### Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

2. **Make your changes**
   - Follow the existing code style
   - Add comprehensive tests
   - Update documentation as needed

3. **Run the full test suite**
   ```bash
   npm run lint
   npm test
   npm run coverage
   ```

4. **Commit your changes**
   ```bash
   git commit -m "feat: add amazing feature"
   ```

5. **Push to your fork**
   ```bash
   git push origin feature/amazing-feature
   ```

6. **Create a Pull Request**
   - Use a descriptive title
   - Include a detailed description
   - Reference any related issues
   - Add screenshots/examples if relevant

## 🧪 Testing Guidelines

### Test Categories

- **Unit Tests**: Test individual functions and components
- **Integration Tests**: Test contract interactions
- **Security Tests**: Test access controls, reentrancy protection, etc.
- **Gas Tests**: Optimize and measure gas usage
- **Property Tests**: Test invariants and edge cases

### Writing Tests

```typescript
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("FeatureName", function () {
  async function deployFixture() {
    // Setup test environment
  }

  it("should handle normal case", async function () {
    const { contract } = await loadFixture(deployFixture);
    // Test implementation
    expect(result).to.equal(expected);
  });

  it("should revert on invalid input", async function () {
    const { contract } = await loadFixture(deployFixture);
    await expect(contract.invalidCall()).to.be.revertedWith("ErrorMessage");
  });
});
```

### Coverage Requirements

- **Minimum Coverage**: 95% for new code
- **Critical Paths**: 100% coverage for liquidation and security functions
- **Edge Cases**: Test boundary conditions and error paths
- **Gas Optimization**: Include gas usage assertions for expensive operations

## 📝 Code Style Guidelines

### Solidity Style

Follow the [Solidity Style Guide](https://docs.soliditylang.org/en/latest/style-guide.html):

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ContractName
 * @notice Brief description
 * @dev Detailed implementation notes
 */
contract ContractName {
    // Constants (UPPER_SNAKE_CASE)
    uint256 public constant MAX_SUPPLY = 1000000e18;
    
    // Immutable variables
    IERC20 public immutable token;
    
    // State variables (camelCase)
    mapping(address => uint256) public balances;
    
    // Events (PascalCase)
    event BalanceUpdated(address indexed user, uint256 newBalance);
    
    // Errors (PascalCase with descriptive names)
    error InsufficientBalance(uint256 requested, uint256 available);
    
    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    // Functions (camelCase)
    function updateBalance(address user, uint256 amount) external onlyOwner {
        // Implementation
    }
}
```

### TypeScript Style

- Use TypeScript for all scripts and tests
- Follow ESLint configuration
- Use `async/await` instead of `.then()`
- Prefer `const` over `let` when possible

## 🔒 Security Considerations

### Security Checklist

Before submitting security-sensitive code:

- [ ] **Reentrancy**: Protected with `nonReentrant` modifier
- [ ] **Access Control**: Proper role-based permissions
- [ ] **Input Validation**: Check all parameters and bounds
- [ ] **Integer Overflow**: Use SafeMath or Solidity 0.8+ checks
- [ ] **External Calls**: Follow Checks-Effects-Interactions pattern
- [ ] **Oracle Usage**: Validate price feeds and staleness
- [ ] **Error Handling**: Proper error messages and revert conditions

### Common Security Patterns

```solidity
// ✅ Good: Proper access control and reentrancy protection
function withdraw(uint256 amount) external nonReentrant onlyRole(WITHDRAWER_ROLE) {
    require(amount > 0, "Zero amount");
    require(balances[msg.sender] >= amount, "Insufficient balance");
    
    // Effects before interactions
    balances[msg.sender] -= amount;
    
    // External call last
    payable(msg.sender).transfer(amount);
}

// ❌ Bad: Missing protection and validation
function withdraw(uint256 amount) external {
    payable(msg.sender).transfer(amount);
    balances[msg.sender] -= amount;
}
```

## 📚 Documentation Standards

### Code Documentation

- Use NatSpec comments for all public/external functions
- Document complex logic with inline comments
- Include examples in documentation when helpful

```solidity
/**
 * @notice Liquidates an undercollateralized vault through commit-reveal auction
 * @dev Implements MEV-resistant batch liquidation mechanism
 * @param vaultId The ID of the vault to liquidate
 * @param bidAmount The amount of collateral to bid for
 * @param bidPrice The price per unit of collateral (in stablecoin)
 * @return auctionId The ID of the created auction batch
 * 
 * Requirements:
 * - Vault must be below liquidation threshold
 * - Caller must provide minimum commit bond
 * - Auction must be in commit phase
 * 
 * Example:
 * ```solidity
 * uint256 auctionId = liquidationEngine.liquidateVault(123, 10e18, 1500e18);
 * ```
 */
function liquidateVault(
    uint256 vaultId,
    uint256 bidAmount, 
    uint256 bidPrice
) external payable returns (uint256 auctionId) {
    // Implementation
}
```

### README Updates

When adding new features, update:

- Feature list in overview section
- Module summary table  
- Usage examples
- Configuration options

## 🐛 Bug Reports

### Bug Report Template

When reporting bugs, include:

1. **Environment**: Node version, network, contract addresses
2. **Expected Behavior**: What should happen
3. **Actual Behavior**: What actually happens
4. **Reproduction Steps**: How to reproduce the issue
5. **Error Messages**: Full error output and stack traces
6. **Additional Context**: Screenshots, logs, etc.

### Security Issues

**Do not report security vulnerabilities as public issues.**

See [SECURITY.md](SECURITY.md) for responsible disclosure procedures.

## 🎯 Feature Requests

### Feature Request Template

1. **Problem**: What problem does this solve?
2. **Solution**: Proposed implementation approach
3. **Alternatives**: Other solutions considered
4. **Impact**: Who benefits and how?
5. **Implementation**: Technical considerations and complexity

## 📋 Review Process

### Code Review Checklist

Reviewers should check:

- [ ] **Functionality**: Does the code work as intended?
- [ ] **Tests**: Adequate test coverage and edge cases
- [ ] **Security**: No security vulnerabilities introduced
- [ ] **Gas Efficiency**: Optimized for reasonable costs
- [ ] **Documentation**: Code is well-documented
- [ ] **Style**: Follows project conventions
- [ ] **Breaking Changes**: Backward compatibility considered

### Review Timeline

- **Initial Review**: Within 48 hours
- **Follow-up**: Within 24 hours of requested changes
- **Final Approval**: When all checks pass and 2+ approvals received

## 🚀 Release Process

### Version Numbering

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Incompatible API changes
- **MINOR**: New functionality (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Checklist

- [ ] All tests passing
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped in package.json
- [ ] Security audit completed (for major releases)
- [ ] Migration guide written (for breaking changes)

## 🤝 Community

### Communication Channels

- **GitHub Discussions**: General questions and discussions
- **GitHub Issues**: Bug reports and feature requests
- **Discord**: Real-time community chat (when available)
- **Twitter**: Announcements and updates (when available)

### Code of Conduct

We are committed to providing a welcoming and inclusive environment:

- Be respectful and constructive in all interactions
- Focus on what is best for the community
- Show empathy towards other community members
- Accept constructive criticism gracefully

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to the Stablecoin Protocol! Your efforts help make DeFi more secure, efficient, and accessible for everyone. 🚀