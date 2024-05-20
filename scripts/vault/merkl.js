const { ethers } = require('hardhat');

const tokenAddress = '0x958d208Cdf087843e9AD98d23823d32E17d723A1';

const recipients = [
    '0x558BDe303ae5C36536B0FB60D9311B2354B4411F',
    '0xCc8F6eE92BA32B926fBDa053333F4dE45842A4A6',
    '0x24E4538ED0AC083a870828236DAa2c0F95ae6b30',
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
    ];

    // Connect to the deployed token contract using the ABI and address
    const token = new ethers.Contract(tokenAddress, abi, deployer);

    const amountToSend = ethers.utils.parseEther('0.5'); // Convert 0.5 ETH to Wei

    // Send tokens to each recipient
    for (let i = 0; i < recipients.length; i++) {
        console.log(`Sending tokens to ${recipients[i]}`);
        try {
            const tx = await token.transfer(recipients[i], amountToSend);
            console.log(`Transfer transaction sent to ${recipients[i]}. Waiting for confirmation...`);
            await tx.wait();
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
