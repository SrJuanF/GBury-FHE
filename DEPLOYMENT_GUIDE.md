# 🚀 Deployment Guide - FHE Enterprises Contracts

This comprehensive guide will help you deploy the `Enterprises_Contracts` smart contract to different networks using the
configured wallet system.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Wallet Configuration](#wallet-configuration)
- [Environment Setup](#environment-setup)
- [Local Development Deployment](#local-development-deployment)
- [Sepolia Testnet Deployment](#sepolia-testnet-deployment)
- [Contract Verification](#contract-verification)
- [Testing After Deployment](#testing-after-deployment)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## Prerequisites

Before starting the deployment process, ensure you have:

- **Node.js** >= 20
- **npm** >= 7.0.0
- **Git** for version control
- **MetaMask** or similar wallet for transaction signing
- **Sepolia ETH** for testnet deployment
- **Etherscan API Key** for contract verification

## Wallet Configuration

The project is configured with three dedicated wallets for testing and deployment:

### Wallet Setup

```typescript
// Configured in hardhat.config.ts
const wallets = {
  employer: process.env.EMPLOYER_PRIVATE_KEY || "0x...",
  customer: process.env.CUSTOMER_PRIVATE_KEY || "0x...",
  user: process.env.USER_PRIVATE_KEY || "0x...",
};
```

### Wallet Roles

- **Employer Wallet** (Primary): Main deployment and contract creation wallet
- **Customer Wallet** (Secondary): Contract signer and testing wallet
- **User Wallet** (Tertiary): Additional signer and testing wallet

### View Configured Accounts

```bash
# Display all configured accounts and their balances
npx hardhat accounts
```

## Environment Setup

### 1. Environment Variables Configuration

Create a `.env` file in the project root:

```env
# Network Configuration
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_API_KEY
MAINNET_RPC_URL=https://mainnet.infura.io/v3/YOUR_API_KEY

# API Keys
ETHERSCAN_API_KEY=your_etherscan_api_key_here
INFURA_API_KEY=your_infura_api_key_here

# Wallet Private Keys (for testing)
EMPLOYER_PRIVATE_KEY=0x...
CUSTOMER_PRIVATE_KEY=0x...
USER_PRIVATE_KEY=0x...

# Optional: Mnemonic for HD wallet
MNEMONIC="your twelve word mnemonic phrase here"
```

### 2. Hardhat Variables Setup

Configure Hardhat variables for secure deployment:

```bash
# Set mnemonic phrase
npx hardhat vars set MNEMONIC "your twelve word mnemonic phrase here"

# Set RPC URLs
npx hardhat vars set SEPOLIA_RPC_URL "https://sepolia.infura.io/v3/YOUR_API_KEY"
npx hardhat vars set MAINNET_RPC_URL "https://mainnet.infura.io/v3/YOUR_API_KEY"

# Set API keys
npx hardhat vars set ETHERSCAN_API_KEY "your_etherscan_api_key_here"
npx hardhat vars set INFURA_API_KEY "your_infura_api_key_here"
```

### 3. Verify Configuration

```bash
# List all configured variables
npx hardhat vars list

# Check network configuration
npx hardhat console --network sepolia
```

## Local Development Deployment

### Option 1: Using Custom Task

```bash
# Deploy to local Hardhat network
npx hardhat deploy:local
```

### Option 2: Manual Local Deployment

```bash
# Start local Hardhat node
npx hardhat node

# In a new terminal, deploy contracts
npx hardhat deploy --network localhost
```

### Option 3: Using Hardhat Console

```bash
# Start Hardhat console
npx hardhat console

# Deploy manually
const EnterprisesContracts = await ethers.getContractFactory("Enterprises_Contracts");
const enterprisesContracts = await EnterprisesContracts.deploy();
await enterprisesContracts.waitForDeployment();
console.log("Contract deployed to:", await enterprisesContracts.getAddress());
```

## Sepolia Testnet Deployment

### Prerequisites for Sepolia

1. **Get Sepolia ETH**: Visit [Sepolia Faucet](https://sepoliafaucet.com/)
2. **Verify RPC URL**: Ensure your Sepolia RPC URL is working
3. **Check Balance**: Verify wallet has sufficient ETH for deployment

### Deployment Commands

#### Option 1: Using Custom Task

```bash
# Deploy to Sepolia with automatic verification
npx hardhat deploy:sepolia
```

#### Option 2: Standard Deployment

```bash
# Deploy to Sepolia
npx hardhat deploy --network sepolia
```

#### Option 3: Force Redeploy

```bash
# Force redeploy (ignores existing deployment)
npx hardhat deploy --network sepolia --reset
```

### Deployment Verification

After deployment, verify the contract was deployed correctly:

```bash
# Check deployment status
npx hardhat deploy:list --network sepolia

# Get contract address
npx hardhat deploy:list --network sepolia --export deployments/sepolia/deployment-info.json
```

## Contract Verification

### Automatic Verification

The deployment script includes automatic verification on Sepolia. If it fails, use manual verification:

### Manual Verification

```bash
# Verify contract on Etherscan
npx hardhat verify --network sepolia 0xCONTRACT_ADDRESS

# Verify with constructor arguments (if needed)
npx hardhat verify --network sepolia 0xCONTRACT_ADDRESS "arg1" "arg2"
```

### Custom Verification Task

```bash
# Use custom verification task
npx hardhat verify:enterprises --address 0xCONTRACT_ADDRESS --network sepolia
```

### Verification Troubleshooting

If verification fails, try these steps:

1. **Wait for block confirmation**: Ensure the contract is confirmed on the blockchain
2. **Check constructor arguments**: Verify all constructor parameters are correct
3. **Use flattened source**: Sometimes verification works better with flattened source code

```bash
# Flatten contract for verification
npx hardhat flatten contracts/Enterprises_Contracts.sol > flattened.sol
```

## Testing After Deployment

### Run Test Suite

```bash
# Run all tests locally
npm run test

# Run tests on Sepolia
npm run test:sepolia

# Run specific test file
npx hardhat test test/FHE_Enterprises_Contracts_Sepolia.ts
```

### Manual Testing

```bash
# Start Hardhat console on Sepolia
npx hardhat console --network sepolia

# Test contract interaction
const contract = await ethers.getContractAt("Enterprises_Contracts", "0xCONTRACT_ADDRESS");
const counter = await contract.getContractCounter();
console.log("Contract counter:", counter.toString());
```

### Integration Testing

```bash
# Run integration tests
npx hardhat test --grep "Integration"

# Run specific test category
npx hardhat test --grep "Create Contract"
npx hardhat test --grep "Sign Contract"
npx hardhat test --grep "Retreat Contract"
```

## Troubleshooting

### Common Deployment Issues

#### 1. Insufficient Funds

```bash
# Check wallet balance
npx hardhat accounts --network sepolia

# Get test ETH from faucet
# Visit: https://sepoliafaucet.com/
```

#### 2. RPC Connection Issues

```bash
# Test RPC connection
npx hardhat console --network sepolia
> await ethers.provider.getBlockNumber()
```

#### 3. Compilation Errors

```bash
# Clean and recompile
npm run clean
npm run compile

# Check for specific errors
npx hardhat compile --force
```

#### 4. Verification Failures

```bash
# Check contract bytecode
npx hardhat verify --network sepolia 0xCONTRACT_ADDRESS --show-stack-traces

# Verify manually on Etherscan
# Go to: https://sepolia.etherscan.io/verifyContract
```

### Error Messages and Solutions

| Error                              | Solution                                                         |
| ---------------------------------- | ---------------------------------------------------------------- |
| `SEPOLIA_RPC_URL not configured`   | Set RPC URL: `npx hardhat vars set SEPOLIA_RPC_URL "your_url"`   |
| `ETHERSCAN_API_KEY not configured` | Set API key: `npx hardhat vars set ETHERSCAN_API_KEY "your_key"` |
| `insufficient funds`               | Get test ETH from Sepolia faucet                                 |
| `nonce too low`                    | Wait for pending transactions or reset nonce                     |
| `gas estimation failed`            | Check contract constructor parameters                            |

### Debug Commands

```bash
# Debug deployment
npx hardhat deploy --network sepolia --verbose

# Check gas estimation
npx hardhat deploy --network sepolia --dry-run

# View deployment logs
npx hardhat deploy:list --network sepolia --export debug.json
```

## Best Practices

### Security Best Practices

1. **Never commit private keys**: Use environment variables or Hardhat vars
2. **Use testnets first**: Always test on Sepolia before mainnet
3. **Verify contracts**: Always verify contracts on Etherscan
4. **Check gas limits**: Ensure sufficient gas for deployment
5. **Backup deployment info**: Save deployment addresses and transaction hashes

### Deployment Checklist

- [ ] Environment variables configured
- [ ] RPC URLs tested and working
- [ ] Wallet has sufficient ETH
- [ ] Contracts compiled successfully
- [ ] Tests passing locally
- [ ] Deployment script reviewed
- [ ] Contract verified on Etherscan
- [ ] Integration tests passing
- [ ] Deployment info saved

### Gas Optimization

```bash
# Check gas usage
npx hardhat test --gas

# Optimize deployment
npx hardhat deploy --network sepolia --gas-price 20000000000
```

## File Structure

```
├── contracts/
│   └── Enterprises_Contracts.sol    # Main contract
├── deploy/
│   └── deploy.ts                    # Deployment script
├── tasks/
│   ├── deploy.ts                    # Custom deployment tasks
│   ├── accounts.ts                  # Account management
│   └── Enterprises.ts               # Enterprise-specific tasks
├── test/
│   └── FHE_Enterprises_Contracts_Sepolia.ts  # Integration tests
├── deployments/
│   └── sepolia/
│       └── Enterprises_Contracts.json        # Deployment artifacts
└── hardhat.config.ts               # Hardhat configuration
```

## Support and Resources

### Documentation

- [Hardhat Documentation](https://hardhat.org/docs)
- [Etherscan Verification](https://docs.etherscan.io/miscellaneous/using-apis)
- [FHEVM Documentation](https://docs.zama.ai/fhevm)

### Useful Commands Reference

```bash
# Development
npm run compile          # Compile contracts
npm run test            # Run tests
npm run clean           # Clean artifacts
npm run lint            # Lint code

# Deployment
npx hardhat deploy --network sepolia
npx hardhat verify --network sepolia 0xADDRESS
npx hardhat accounts --network sepolia

# Debugging
npx hardhat console --network sepolia
npx hardhat node
npx hardhat test --verbose
```

### Getting Help

For deployment issues:

1. Check the troubleshooting section above
2. Review deployment logs for specific errors
3. Verify network configuration in `hardhat.config.ts`
4. Ensure all environment variables are set correctly
5. Check contract compilation and test results

---

**Note**: This deployment guide is specifically designed for the FHE Enterprises Contracts project. Always test
thoroughly on testnets before deploying to mainnet.
