const { ethers } = require('hardhat');

// Replace with your LP token address and staking contract address
const lpTokenAddress = '0x532d6b9F2B86E9C61774D53079Ae538A51ac67C5';
const stakingContractAddress = '0xEb5660d41Ba65DbAa4c5EDd873140942DBc13955';

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log('Using the account:', deployer.address);

    // Load the LP token contract ABI
    const lpTokenAbi = [
        {
            "constant": true,
            "inputs": [],
            "name": "name",
            "outputs": [
                {
                    "name": "",
                    "type": "string"
                }
            ],
            "payable": false,
            "stateMutability": "view",
            "type": "function"
        },
        {
            "constant": false,
            "inputs": [
                {
                    "name": "_spender",
                    "type": "address"
                },
                {
                    "name": "_value",
                    "type": "uint256"
                }
            ],
            "name": "approve",
            "outputs": [
                {
                    "name": "",
                    "type": "bool"
                }
            ],
            "payable": false,
            "stateMutability": "nonpayable",
            "type": "function"
        },
    ];

    // Connect to the LP token contract using the ABI and address
    const lpTokenContract = new ethers.Contract(lpTokenAddress, lpTokenAbi, deployer);

    // Load the staking contract ABI
    const stakingContractAbi = [
        {
            "inputs": [
                {
                    "internalType": "uint256",
                    "name": "_amount",
                    "type": "uint256"
                }
            ],
            "name": "stake",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        }
    ];

    // Connect to the staking contract using the ABI and address
    const stakingContract = new ethers.Contract(stakingContractAddress, stakingContractAbi, deployer);

    // Max amount for approval
    const maxApproval = ethers.constants.MaxUint256;

    // Your regular amount
    const amountToStake = ethers.utils.parseEther('0.137439303004165681');

    try {
        console.log(`Approving LP tokens for staking contract ${stakingContractAddress}`);

        // Call the approve function with maxApproval
        const txApproval = await lpTokenContract.approve(stakingContractAddress, maxApproval);

        console.log('Transaction sent for approval. Waiting for confirmation...');

        // Wait for the approval transaction to be confirmed
        await txApproval.wait();

        console.log('LP tokens approved for staking contract');

        // Now stake the LP tokens
        console.log('Staking LP tokens...');
        const stakeTx = await stakingContract.stake(amountToStake);
        console.log('Stake transaction sent. Waiting for confirmation...');
        await stakeTx.wait();
        console.log('LP tokens staked successfully!');
    } catch (error) {
        console.error('Failed to approve LP tokens or stake:', error);
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });