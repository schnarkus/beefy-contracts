const { ethers } = require('hardhat');

const tokenAddresses = [
    '0x94fcACbE393cf84e94638dc9616Ee84Ff0031806',
    '0x82090669f82cfb6F6C84122CA6818Afa616d980F',
    '0x89D0A19e73416dCE724A9a4C73F27A6736F25858',
    '0xe43c65ACd8ed1e7a8e0DFEe5888F081Ee36D7aCB',
];

const recipient = '0x65CF7E8C0d431f59787D07Fa1A9f8725bbC33F7E';

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
