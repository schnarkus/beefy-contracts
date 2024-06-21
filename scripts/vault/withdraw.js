const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();

    const contractAddress = "0x532d6b9F2B86E9C61774D53079Ae538A51ac67C5";
    const contractABI = [
        {
            "inputs": [],
            "name": "isCalm",
            "outputs": [
                {
                    "internalType": "bool",
                    "name": "",
                    "type": "bool"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "address",
                    "name": "account",
                    "type": "address"
                }
            ],
            "name": "balanceOf",
            "outputs": [
                {
                    "internalType": "uint256",
                    "name": "",
                    "type": "uint256"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "uint256",
                    "name": "_shares",
                    "type": "uint256"
                }
            ],
            "name": "previewWithdraw",
            "outputs": [
                {
                    "internalType": "uint256",
                    "name": "amount0",
                    "type": "uint256"
                },
                {
                    "internalType": "uint256",
                    "name": "amount1",
                    "type": "uint256"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "uint256",
                    "name": "_minAmount0",
                    "type": "uint256"
                },
                {
                    "internalType": "uint256",
                    "name": "_minAmount1",
                    "type": "uint256"
                }
            ],
            "name": "withdrawAll",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        }
    ];

    const contract = new ethers.Contract(contractAddress, contractABI, deployer);

    // Step 1: Check if the contract is calm
    const isCalm = await contract.isCalm();
    console.log(`Is the contract calm? ${isCalm}`);

    if (isCalm) {
        console.log("The contract is calm. Aborting the withdrawal process.");
        return;
    }

    const userAddress = "0xfB41Cbf2ce16E8f626013a2F465521d27BA9a610";

    // Step 2: Get the balance of shares
    const userBalance = await contract.balanceOf(userAddress);
    console.log(`User balance (shares): ${userBalance.toString()}`);

    if (userBalance.isZero()) {
        console.log("User has no shares to withdraw.");
        return;
    }

    // Step 3: Get the minimum withdrawal amounts using previewWithdraw
    const previewWithdraw = await contract.previewWithdraw(userBalance);
    const minAmount0 = previewWithdraw.amount0;
    const minAmount1 = previewWithdraw.amount1;

    console.log(`Preview Withdraw - amount0: ${minAmount0.toString()}, amount1: ${minAmount1.toString()}`);

    // Step 4: Call withdrawAll with the minimum amounts
    const tx = await contract.withdrawAll(minAmount0, minAmount1);
    await tx.wait();
    console.log("Withdraw all successful");
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });