require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: ".env" });

const PK = process.env.DEPLOYER_PRIVATE_KEY;
const accounts = PK ? [PK] : [];

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
      evmVersion: "cancun"
    }
  },
  networks: {
    hardhat: { hardfork: "cancun" },
    sepolia: {
      url: process.env.NEXT_PUBLIC_RPC_URL_SEPOLIA || "https://rpc.sepolia.org",
      accounts
    },
    mainnet: {
      url: process.env.NEXT_PUBLIC_RPC_URL_MAINNET || "https://eth.llamarpc.com",
      accounts
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  }
};
