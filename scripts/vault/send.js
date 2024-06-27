const { ethers } = require('hardhat');

const tokenAddresses = [
    '0x60240Fa2a29c4ee646F03d5495038F2a6e969b80',
    '0x39996402270c1Ec646004C4E9e44189669E5f8D2',
];

const recipient = '0x6d28afD25a1FBC5409B1BeFFf6AEfEEe2902D89F';

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log('Calling transferOwnership on contracts with the account:', deployer.address);

    // Load the contract ABI for the transferOwnership function
    const abi = [
        {
            "inputs": [
                {
                    "internalType": "address",
                    "name": "newOwner",
                    "type": "address"
                }
            ],
            "name": "transferOwnership",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        }
    ];

    // Iterate through each contract address
    for (const address of tokenAddresses) {
        console.log(`Transferring ownership of contract ${address} to ${recipient}`);
        try {
            // Connect to the deployed contract using the ABI and address
            const contract = new ethers.Contract(address, abi, deployer);
            // Call the transferOwnership function
            const tx = await contract.transferOwnership(recipient);
            console.log(`Transfer transaction sent to ${address}. Waiting for confirmation...`);
            // Wait for the transaction to be confirmed
            await tx.wait();
            console.log(`Ownership transferred for contract ${address}`);
        } catch (error) {
            console.error(`Failed to transfer ownership for contract ${address}:`, error);
        }
    }

    console.log('Ownership transferred for all contracts!');
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
