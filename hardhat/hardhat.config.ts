import { defineConfig, configVariable } from "hardhat/config";
import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";
// Load hardhat/.env into process.env so configVariable() can read ARC_PRIVATE_KEY.
// (Hardhat 3 reads config variables from env vars by default but does NOT auto-load .env.)
import "dotenv/config";

export default defineConfig({
  plugins: [hardhatToolboxViem],
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
      arcTestnet: {
      type: "http",
      chainType: "l1",
      url: "https://rpc.testnet.arc.network",
      chainId: 5042002,
      accounts: [configVariable("ARC_PRIVATE_KEY")],
    },
  },
});
