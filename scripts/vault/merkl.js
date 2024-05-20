const { ethers } = require('hardhat');

const tokenAddress = '0x958d208Cdf087843e9AD98d23823d32E17d723A1';

const recipients = [
    '0xf68A6697831FBA78f25CdFb1394b858fEd6F3659',
    '0x14bcD2bC6e516fa296636a55d1cc24fa89Cbc5B1',
    '0x63E495D7e87CF451d986D6E03015cD78b0CaEeda',
    '0xD4a88FDBdd57c465E125c0021b40f58eb86aA13E',
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
