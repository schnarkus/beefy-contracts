import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-gas-reporter";
// import "@typechain/hardhat";
import "./tasks";

import { HardhatUserConfig } from "hardhat/src/types/config";
import { HardhatUserConfig as WithEtherscanConfig } from "hardhat/config";
import { buildHardhatNetworkAccounts, getPKs } from "./utils/configInit";

type DeploymentConfig = HardhatUserConfig & WithEtherscanConfig;

const accounts = getPKs();
const hardhatNetworkAccounts = buildHardhatNetworkAccounts(accounts);

const config: DeploymentConfig = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      // accounts visible to hardhat network used by `hardhat node --fork` (yarn net <chainName>)
      accounts: hardhatNetworkAccounts,
    },
    mainnet: {
      url: process.env.MAINNET_RPC || "https://rpc.ankr.com/eth",
      chainId: 1,
      accounts,
    },
    ethereum: {
      url: process.env.ETH_RPC || "https://rpc.ankr.com/eth",
      chainId: 1,
      accounts,
    },
    bsc: {
      url: process.env.BSC_RPC || "https://bsc-dataseed1.binance.org",
      chainId: 56,
      gasMultiplier: 2,
      accounts,
    },
    heco: {
      url: process.env.HECO_RPC || "https://http-mainnet-node.huobichain.com",
      chainId: 128,
      accounts,
    },
    avax: {
      url: process.env.AVAX_RPC || "https://rpc.ankr.com/avalanche",
      chainId: 43114,
      accounts,
    },
    polygon: {
      url: process.env.POLYGON_RPC || "https://polygon.llamarpc.com",
      chainId: 137,
      gasMultiplier: 100,
      accounts,
    },
    fantom: {
      url: process.env.FANTOM_RPC || "https://rpc.ftm.tools",
      chainId: 250,
      accounts,
    },
    one: {
      url: process.env.ONE_RPC || "https://api.s0.t.hmny.io/",
      chainId: 1666600000,
      accounts,
    },
    arbitrum: {
      url: process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc",
      chainId: 42161,
      accounts,
    },
    moonriver: {
      url: process.env.MOONRIVER_RPC || "https://rpc.moonriver.moonbeam.network",
      chainId: 1285,
      accounts,
    },
    celo: {
      url: process.env.CELO_RPC || "https://forno.celo.org",
      chainId: 42220,
      accounts,
    },
    cronos: {
      // url: "https://evm-cronos.crypto.org",
      url: process.env.CRONOS_RPC || "https://rpc.vvs.finance/",
      chainId: 25,
      accounts,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      timeout: 300000,
      accounts: "remote",
    },
    testnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
      chainId: 97,
      accounts,
    },
    kovan: {
      url: "https://kovan.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
      chainId: 42,
      accounts,
    },
    aurora: {
      url: process.env.AURORA_RPC || "https://mainnet.aurora.dev/Fon6fPMs5rCdJc4mxX4kiSK1vsKdzc3D8k6UF8aruek",
      chainId: 1313161554,
      accounts,
    },
    fuse: {
      url: process.env.FUSE_RPC || "https://rpc.fuse.io",
      chainId: 122,
      accounts,
    },
    metis: {
      url: process.env.METIS_RPC || "https://andromeda.metis.io/?owner=1088",
      chainId: 1088,
      accounts,
    },
    moonbeam: {
      url: process.env.MOONBEAM_RPC || "https://rpc.api.moonbeam.network",
      chainId: 1284,
      accounts,
    },
    sys: {
      url: process.env.SYS_RPC || "https://rpc.syscoin.org/",
      chainId: 57,
      accounts,
    },
    emerald: {
      url: process.env.EMERALD_RPC || "https://emerald.oasis.dev",
      chainId: 42262,
      accounts,
    },
    optimism: {
      url: process.env.OPTIMISM_RPC || "https://optimism.meowrpc.com",
      chainId: 10,
      accounts,
    },
    base: {
      url: process.env.OPTIMISM_RPC || "https://base.blockpi.network/v1/rpc/public",
      chainId: 8453,
      gasMultiplier: 0.1,
      accounts,
    },
    kava: {
      url: process.env.KAVA_RPC || "https://evm2.kava.io",
      chainId: 2222,
      gasMultiplier: 10,
      accounts,
    },
  },
  etherscan: {
    apiKey: {
      kava: "api key is not required by the Kava explorer, but can't be empty",
      opera: "3R44JA94ATTCDN1S88GGKGZR8Q76K6ZBD3",
      bsc: "JCB67ISDI9FYJ6DC3RJFDVH5AZ3PTRTX95",
      polygon: "2DJYB7G1D3WGIFT1SY7FGXFFN85UUCD4AV",
    },
    customChains: [
      {
        network: "kava",
        chainId: 2222,
        urls: {
          apiURL: "https://explorer.kava.io/api",
          browserURL: "https://explorer.kava.io/"
        }
      }
    ]
  },
  solidity: {
    compilers: [
      {
        version: "0.8.15",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.6.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.5.5",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  paths: {
    sources: "./contracts/BIFI",
  },
};

export default config;
