const { ethers } = require('hardhat');

const tokenAddresses = [
    '0x558BDe303ae5C36536B0FB60D9311B2354B4411F',
    '0xCc8F6eE92BA32B926fBDa053333F4dE45842A4A6',
    '0x24E4538ED0AC083a870828236DAa2c0F95ae6b30',
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
