const { ethers } = require('hardhat');

const tokenAddress = '0x958d208Cdf087843e9AD98d23823d32E17d723A1';

const recipients = [
    '0x14e845491fB2dad506DD628d49741F28dc601e14',
    '0x479C32cbf558bB1a54e6C5e6e874a67d0F2DDdca',
    '0xEF8909ceD1fFA213e56B783C1a1A463dD1FF8048',
    '0x6Ed9f18397ACd914CBCde1323F0Dd696E0ac79B7',
    '0x09D8CAb9DE699De01E47FCDaB50364F455dC712b'
];

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log('Sending tokens with the account:', deployer.address);

    // Load the contract ABI
    const abi = [
        {
            "inputs": [
                {
                    "internalType": "address",
                    "name": "recipient",
                    "type": "address"
                },
                {
                    "internalType": "uint256",
                    "name": "amount",
                    "type": "uint256"
                }
            ],
            "name": "transfer",
            "outputs": [
                {
                    "internalType": "bool",
                    "name": "",
                    "type": "bool"
                }
            ],
            "stateMutability": "nonpayable",
            "type": "function"
        }
    ]

    // Connect to the deployed token contract using the ABI and address
    const token = new ethers.Contract(tokenAddress, abi, deployer);

    const amountToSend = ethers.utils.parseEther('0.5'); // Convert 0.5 ETH to Wei

    // Send tokens to each recipient
    for (let i = 0; i < recipients.length; i++) {
        console.log(`Sending tokens to ${recipients[i]}`);
        try {
            await token.transfer(recipients[i], amountToSend);
            console.log(`Tokens sent to ${recipients[i]}`);
        } catch (error) {
            console.error(`Failed to send tokens to ${recipients[i]}:`, error);
        }
    }

    console.log('Tokens sent to all recipients!');
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
