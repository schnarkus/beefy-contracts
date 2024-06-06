require('dotenv').config();
const { ethers } = require("hardhat");

async function main() {
    const vaultAddress = "0xB98DbfC86D6fB8aaB65726a9FEBd7CfAbb5b998a";
    const tokenAddress = "0x73958d46B7aA2bc94926d8a215Fa560A5CdCA3eA";

    const vaultAbi = [
        {
            "inputs": [
                {
                    "internalType": "uint256",
                    "name": "_amount",
                    "type": "uint256"
                }
            ],
            "name": "deposit",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [],
            "name": "depositAll",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        }
    ];

    const tokenAbi = [
        {
            "inputs": [
                {
                    "internalType": "address",
                    "name": "spender",
                    "type": "address"
                },
                {
                    "internalType": "uint256",
                    "name": "amount",
                    "type": "uint256"
                }
            ],
            "name": "approve",
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

    // Get the private key and fork URL from the .env file
    const privateKey = process.env.DEPLOYER_PK;
    const forkUrl = process.env.FORK_URL;
    if (!privateKey || !forkUrl) {
        console.error("Please set your PRIVATE_KEY and FORK_URL in a .env file");
        process.exit(1);
    }

    // Connect to the Anvil forked Polygon network
    const provider = new ethers.providers.JsonRpcProvider(forkUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    // Create contract instances
    const vault = new ethers.Contract(vaultAddress, vaultAbi, wallet);
    const token = new ethers.Contract(tokenAddress, tokenAbi, wallet);

    // Approve 1 ether worth of the token
    const amountToApprove = ethers.utils.parseEther("1.0"); // 1 ether
    const approveTx = await token.approve(vaultAddress, amountToApprove);
    await approveTx.wait();
    console.log("Approved 1 ether worth of tokens");

    // Deposit 1 ether worth of the token
    const depositTx = await vault.deposit(amountToApprove);
    await depositTx.wait();
    console.log("Deposited 1 ether worth of tokens");

    // Optionally, deposit all (commented out)
    // const depositAllTx = await vault.depositAll();
    // await depositAllTx.wait();
    // console.log("Deposited all tokens");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
