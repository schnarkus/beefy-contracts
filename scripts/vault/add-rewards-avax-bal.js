// Import necessary libraries from Hardhat
const hre = require("hardhat");
const { BigNumber } = ethers;
import { addressBook } from "blockchain-addressbook";

const RouterType = {
    BALANCER: BigNumber.from(0),
    UNISWAP_V2: BigNumber.from(1),
    UNISWAP_V3: BigNumber.from(2),
    TRADER_JOE: BigNumber.from(3),
};

const joePath = {
    pairBinSteps: [1],
    versions: [1],
    tokenPath: ['0x8729438EB15e2C8B576fCc6AeCdA6A148776C0F5']
};

const {
    tokens: {
        AVAX: { address: AVAX },
        aQI: { address: aQI },
    },
} = addressBook.avax;

async function main() {
    // Get the deployed contract instance
    const StrategyBalancerMultiReward = await hre.ethers.getContractFactory("StrategyBalancerMultiReward");
    const contractAddress = "0x09cD0B51DF0A2E8C6238dD269f2f3c789d13b809"; // Provide the deployed contract address
    const contract = await StrategyBalancerMultiReward.attach(contractAddress);

    // Specify function arguments for addRewardToken
    const token = "0x8729438EB15e2C8B576fCc6AeCdA6A148776C0F5"; // Token address you want to add as a reward
    const router = "0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106"; // Router address (Uniswap V2 Router or other)
    const routerType = RouterType.UNISWAP_V2; // Router type enum value (e.g., for Uniswap V2)
    const swapInfo = [["0x0000000000000000000000000000000000000000000000000000000000000000", 0, 1]]; // Add swap info array if needed
    const assets = ["0x8729438EB15e2C8B576fCc6AeCdA6A148776C0F5", "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7"]; // Array of asset addresses
    const routeToNative = ethers.utils.solidityPack(["address", "address"], [aQI, AVAX]), // Route to native token
    const minAmount = 0; // Minimum amount required

    // Call addRewardToken function
    const tx = await contract.addRewardToken(
        token,
        router,
        routerType,
        swapInfo,
        assets,
        routeToNative,
        joePath,
        minAmount
    );

    // Wait for the transaction to be mined
    await tx.wait();

    console.log("Reward token added successfully!");
}

// Execute the main function
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
