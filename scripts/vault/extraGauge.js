// Import required libraries
const { ethers } = require('hardhat');

// ABI of the contract
const abi = [
    {
        "inputs": [],
        "name": "extraRewardsLength",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "name": "extraRewards",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];


// Contract address where the contract is deployed
const contractAddress = '0x331a1213953e324955b2a121079d8ffd08eae9fd'; // Update with the actual contract address

async function main() {
    const [signer] = await ethers.getSigners();

    const contract = new ethers.Contract(contractAddress, abi, signer);

    try {
        const extraRewardsLength = await contract.extraRewardsLength();
        if (extraRewardsLength > 0) {
            console.log(`Total Extra Rewards: ${extraRewardsLength}`);

            const maxRewardsToFetch = Math.min(extraRewardsLength.toNumber(), 3); // Fetch up to 3 extra rewards

            for (let i = 0; i < maxRewardsToFetch; i++) {
                const rewardAddress = await contract.extraRewards(i);
                console.log(`Extra Reward ${i + 1} Address: ${rewardAddress}`);
            }
        } else {
            console.log('No extra rewards available.');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });