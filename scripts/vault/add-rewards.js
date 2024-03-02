import { ethers } from "hardhat";

import { addressBook } from "blockchain-addressbook";
import stratAbi from "../../artifacts/contracts/BIFI/strategies/Balancer/StrategyAuraSideChain.sol/StrategyAuraSideChain.json";

const {
    tokens: {
        AURA: { address: AURA },
        BAL: { address: BAL },
        ETH: { address: ETH },
    },
} = addressBook.arbitrum;

const bytes0 = "0x0000000000000000000000000000000000000000000000000000000000000000";

async function main() {
    const contractAddress = "0xd4D1b2678c72b6EdB02A02c42d2dF357C464d04E"; // Contract address
    const contract = await ethers.getContractAt(stratAbi.abi, contractAddress); // Get contract instance

    // Add reward tokens
    const rewardToken = AURA; // Address of the reward token
    const rewardRoute = [
        ["0xbcaa6c053cab3dd73a2e898d89a4f84a180ae1ca000100000000000000000458", 0, 1],
        ["0xcc65a812ce382ab909a11e434dbf75b34f1cc59d000200000000000000000001", 1, 2],
    ]; // Route for swapping rewards
    const rewardAssets = [AURA, BAL, ETH]; // Reward assets
    const additionalData = bytes0; // None for balancer swap
    const weight = 100; // Weight for the reward token

    const addRewardTx = await contract.addRewardToken(
        rewardToken,
        rewardRoute,
        rewardAssets,
        additionalData,
        weight
    );

    // Wait for the transaction to be mined
    const receipt = await addRewardTx.wait();

    // Log transaction hash
    console.log("Transaction hash:", receipt.transactionHash);

    // Check if the transaction was successful
    if (receipt.status === 1) {
        console.log("Reward token added successfully!");
    } else {
        console.log("Failed to add reward token.");
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
