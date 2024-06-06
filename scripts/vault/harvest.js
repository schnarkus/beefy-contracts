require('dotenv').config();
const { ethers } = require("hardhat");

async function main() {

    const strategyAddress = "0x52E147101a96FeFe1eb71dae93a72945C58454fB";

    const strategyAbi = [
        {
            "inputs": [],
            "name": "harvest",
            "outputs": [],
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

    // Create contract instance
    const strategy = new ethers.Contract(strategyAddress, strategyAbi, wallet);

    // Call harvest
    const tx = await strategy.harvest();
    await tx.wait();
    console.log("Harvest successful");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
