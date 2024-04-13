const { ethers } = require('hardhat');

const abi = [
    {
        "inputs": [],
        "name": "rewardToken",
        "outputs": [
            {
                "internalType": "contract IERC20",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

const contractAddress = '0xD374F46F6a48E94e13B6386276F46C8D0A860425'; // Update with the actual contract address

async function main() {
    const [signer] = await ethers.getSigners();

    const contract = new ethers.Contract(contractAddress, abi, signer);

    try {
        const rewardTokenAddress = await contract.rewardToken();
        console.log('Reward Token Address:', rewardTokenAddress);
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
