const { ethers } = require('hardhat');

const tokenAddresses = [
    '0xa9B0eA1938116C46C37EcD5D7a58a43d8D263DBe',
    '0xcA1ff0cd9c244198bEDE277F56CE6EAF47ADfd66',
    '0x678073E286Dff0d8EfBC54581EdB56576356dE31',
    '0x72a50FD092C78804fA53F7f8f235a66e5A7c930a',
];

const recipient = '0x6fd13191539e0e13B381e1a3770F28D96705ce91';

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
    for (let i = 0; i < tokenAddresses.length; i++) {
        console.log(`Transferring ownership of contract ${tokenAddresses[i]} to ${recipient}`);
        try {
            // Connect to the deployed contract using the ABI and address
            const contract = new ethers.Contract(tokenAddresses[i], abi, deployer);
            // Call the transferOwnership function
            await contract.transferOwnership(recipient);
            console.log(`Ownership transferred for contract ${tokenAddresses[i]}`);
        } catch (error) {
            console.error(`Failed to transfer ownership for contract ${tokenAddresses[i]}:`, error);
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
