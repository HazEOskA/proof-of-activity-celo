import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],

  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },

  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    celoSepolia: {
      type: "http",
      chainType: "op",
      url: "https://forno.celo-sepolia.celo-testnet.org/",
      chainId: 11142220,
      accounts: [configVariable("CELO_SEPOLIA_PRIVATE_KEY")],
    },
  },
});
