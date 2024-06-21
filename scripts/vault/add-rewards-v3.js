import { ethers } from "hardhat";

import { addressBook } from "blockchain-addressbook";
import stratAbi from "../../artifacts/contracts/BIFI/strategies/Balancer/StrategyAuraGyroSidechain.sol/StrategyAuraGyroSidechain.json";

const {
    tokens: {
        ETH: { address: ETH },
        ARB: { address: ARB },
    },
} = addressBook.arbitrum;

async function main() {
    const contractAddress = "0xF9258144f91290Bb1288B807fC2902279e4abC7d"; // Contract address
    const contract = await ethers.getContractAt(stratAbi.abi, contractAddress); // Get contract instance

    // Add reward tokens
    const rewardToken = ARB; // Address of the reward token
    const rewardRoute = [["0x0000000000000000000000000000000000000000000000000000000000000000", 0, 1]]; // Route for swapping rewards
    const rewardAssets = ["0x0000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000000"]; // Reward assets
    const additionalData = ethers.utils.solidityPack(["address", "uint24", "address"], [ARB, 500, ETH]); // uint24 is for fee on the v3 lp
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
