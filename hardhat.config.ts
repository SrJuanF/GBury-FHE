import "@fhevm/hardhat-plugin";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import "@typechain/hardhat";
import "hardhat-deploy";
import "hardhat-gas-reporter";
import type { HardhatUserConfig } from "hardhat/config";
import { vars } from "hardhat/config";
import "solidity-coverage";
import { ethers } from "ethers";
import "./tasks/accounts";
import "./tasks/Enterprises";

// Run 'npx hardhat vars setup' to see the list of variables that need to be set

const SEPOLIA_RPC_URL: string = vars.get("SEPOLIA_RPC_URL");
const ETHERSCAN_API_KEY: string = vars.get("ETHERSCAN_API_KEY");

const MNEMONIC: string = vars.get("MNEMONIC");
// Obtener las claves privadas directamente de las variables de entorno
const PRIVATE_KEY_1: string = vars.get("PRIVATE_KEY_1"); 
const PRIVATE_KEY_2: string = vars.get("PRIVATE_KEY_2"); 
const PRIVATE_KEY_5: string = vars.get("PRIVATE_KEY_5"); 
const PRIVATE_KEY_6: string = vars.get("PRIVATE_KEY_6"); 

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      accounts: {
        mnemonic: MNEMONIC,
        path: "m/44'/60'/0'/0/",
        count: 10,
      },
      chainId: 31337,
    },
    localhost: {
      url: "http://localhost:8545",
      chainId: 31337,
      accounts: [PRIVATE_KEY_1, PRIVATE_KEY_2, PRIVATE_KEY_5, PRIVATE_KEY_6],
    },
    anvil: {
      url: "http://localhost:8545",
      chainId: 31337,
      accounts: [PRIVATE_KEY_1, PRIVATE_KEY_2, PRIVATE_KEY_5, PRIVATE_KEY_6],
    },
    sepolia: {
      url: SEPOLIA_RPC_URL,
      chainId: 11155111,
      accounts: [PRIVATE_KEY_1, PRIVATE_KEY_2, PRIVATE_KEY_5, PRIVATE_KEY_6],
      verify: {
        etherscan: {
          apiKey: ETHERSCAN_API_KEY,
        },
      },
    },
  },
  namedAccounts: {
    deployer: 0,
    employer: 0, // wallet1
    customer: 1, // wallet2
    user: 2, // wallet3
    emptSigner:3, // wallet4
  },
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY,
    },
  },
  gasReporter: {
    currency: "USD",
    enabled: process.env.REPORT_GAS ? true : false,
    excludeContracts: [],
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  solidity: {
    compilers: [
      {
        version: "0.8.24",
        settings: {
          optimizer: {
            enabled: true,
            runs: 50,
          },
          viaIR: true,
        },
      },
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 50,
          },
          viaIR: true,
        },
      },
    ],
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
  mocha: {
    timeout: 200000,
  },
};

export default config;
