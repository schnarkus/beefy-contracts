const { ethers } = require('hardhat');

const tokenAddresses = [
    '0x14e845491fB2dad506DD628d49741F28dc601e14',
    '0x479C32cbf558bB1a54e6C5e6e874a67d0F2DDdca',
    '0xEF8909ceD1fFA213e56B783C1a1A463dD1FF8048',
    '0x6Ed9f18397ACd914CBCde1323F0Dd696E0ac79B7',
    '0x09D8CAb9DE699De01E47FCDaB50364F455dC712b'
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
