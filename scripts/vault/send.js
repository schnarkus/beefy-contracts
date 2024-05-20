const { ethers } = require('hardhat');

const tokenAddresses = [
    '0xf68A6697831FBA78f25CdFb1394b858fEd6F3659',
    '0x14bcD2bC6e516fa296636a55d1cc24fa89Cbc5B1',
    '0x63E495D7e87CF451d986D6E03015cD78b0CaEeda',
    '0xD4a88FDBdd57c465E125c0021b40f58eb86aA13E',
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
