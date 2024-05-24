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

const contractAddress = '0xdcFAcD324D40d346C1A85651D6775D6BB782CDBe'; // Update with the actual contract address

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
