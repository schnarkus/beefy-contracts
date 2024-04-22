// Import necessary libraries from Hardhat
const hre = require("hardhat");

async function main() {
    // Get the deployed contract instance
    const StrategyBalancerMultiReward = await hre.ethers.getContractFactory("StrategyBalancerMultiReward");
    const contractAddress = "0x117420073Df336Fc1424790E2f8f3F2501F8aFf8"; // Provide the deployed contract address
    const contract = await StrategyBalancerMultiReward.attach(contractAddress);

    // Specify function arguments for addRewardToken
    const token = "0x8729438EB15e2C8B576fCc6AeCdA6A148776C0F5"; // Token address you want to add as a reward
    const router = "0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106"; // Router address (Uniswap V2 Router or other)
    const routerType = 3; // Router type enum value (e.g., for Uniswap V2)
    const swapInfo = []; // Add swap info array if needed
    const assets = ["0x8729438EB15e2C8B576fCc6AeCdA6A148776C0F5", "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7"]; // Array of asset addresses
    const routeToNative = "0xROUTE_TO_NATIVE"; // Route to native token
    const joePath = []; // Joe path array if needed
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
