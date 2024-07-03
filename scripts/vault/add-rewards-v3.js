import { ethers } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import stratAbi from "../../artifacts/contracts/BIFI/strategies/Balancer/StrategyAuraBalancerGyro.sol/StrategyAuraBalancerGyro.json";

const {
    tokens: {
        ARB: { address: ARB },
    },
} = addressBook.arbitrum;

async function main() {
    const contractAddress = "0x791B597a954475CA1B9288E67Bd4C3a4F9707F83"; // Contract address
    const contract = await ethers.getContractAt(stratAbi.abi, contractAddress); // Get contract instance

    const addRewardTx = await contract.addReward(ARB); // Add ARB as a reward token

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
