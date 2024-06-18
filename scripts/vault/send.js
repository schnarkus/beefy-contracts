const { ethers } = require('hardhat');

const tokenAddresses = [
    '0x2706d38D63F1D3c3FDb8bd3d4D34cCDFf88161bB',
    '0x95e24537456e5A090B43A6aDe16795F718bDADFB',
    '0x2B4E2c73D82F1c489C15ac113D888B126D1a12F6',
];

const recipient = '0x3B60F7f25b09E71356cdFFC6475c222A466a2AC9';

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
