const { ethers } = require('hardhat');

// Replace with your contract address and token addresses
const contractAddress = '0x532d6b9F2B86E9C61774D53079Ae538A51ac67C5';
const token1Address = '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85';
const token2Address = '0xc55E93C62874D8100dBd2DfE307EDc1036ad5434';

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log('Using the account:', deployer.address);

    // Load the ERC20 contract ABI
    const erc20Abi = [
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
        // Add other required ERC20 functions here
    ];

    // Connect to the token contracts using the ABI and addresses
    const token1 = new ethers.Contract(token1Address, erc20Abi, deployer);
    const token2 = new ethers.Contract(token2Address, erc20Abi, deployer);

    // Max amount for approval
    const maxApproval = ethers.constants.MaxUint256;

    // Approve token1
    try {
        console.log(`Approving token1 for ${contractAddress}`);
        let tx = await token1.approve(contractAddress, maxApproval);
        await tx.wait();
        console.log('Token1 approved');
    } catch (error) {
        console.error('Failed to approve token1:', error);
        return;
    }

    // Approve token2
    try {
        console.log(`Approving token2 for ${contractAddress}`);
        let tx = await token2.approve(contractAddress, maxApproval);
        await tx.wait();
        console.log('Token2 approved');
    } catch (error) {
        console.error('Failed to approve token2:', error);
        return;
    }

    // Load the contract ABI for deposit function
    const depositAbi = [
        {
            "inputs": [
                {
                    "internalType": "uint256",
                    "name": "_amount0",
                    "type": "uint256"
                },
                {
                    "internalType": "uint256",
                    "name": "_amount1",
                    "type": "uint256"
                },
                {
                    "internalType": "uint256",
                    "name": "_minShares",
                    "type": "uint256"
                }
            ],
            "name": "deposit",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        }
    ];

    // Connect to the deployed contract using the ABI and address
    const contract = new ethers.Contract(contractAddress, depositAbi, deployer);

    // Specified amounts
    const amount0 = ethers.utils.parseUnits('45.956081', 6);  // Token 1 amount
    const amount1 = ethers.utils.parseUnits('0.002063406693850583', 18);  // Token 2 amount
    const minShares = ethers.BigNumber.from('0');

    try {
        console.log(`Calling deposit with amount0: ${amount0.toString()}, amount1: ${amount1.toString()}, minShares: ${minShares.toString()}`);

        // Call the deposit function
        const tx = await contract.deposit(amount0, amount1, minShares);

        console.log('Transaction sent. Waiting for confirmation...');

        // Wait for the transaction to be confirmed
        await tx.wait();

        console.log('Deposit transaction confirmed');
    } catch (error) {
        console.error('Failed to call deposit:', error);
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });