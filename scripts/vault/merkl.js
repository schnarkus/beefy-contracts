const { ethers } = require('hardhat');

const tokenAddress = '0x958d208Cdf087843e9AD98d23823d32E17d723A1';

const recipients = [
    '0xa9B0eA1938116C46C37EcD5D7a58a43d8D263DBe',
    '0xcA1ff0cd9c244198bEDE277F56CE6EAF47ADfd66',
    '0x678073E286Dff0d8EfBC54581EdB56576356dE31',
    '0x72a50FD092C78804fA53F7f8f235a66e5A7c930a',
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
