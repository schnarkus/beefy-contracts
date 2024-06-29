const hardhat = require("hardhat");

const config = {
    strategyAddress: "0x48afC015BdcE9949B8e2CF22eEcB25bcD8D4A0a2",
    strategyAbi: [
        {
            "inputs": [],
            "name": "harvest",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        }
    ]
};

async function main() {
    await hardhat.run("compile");

    try {
        // Retrieve provider and signer from Hardhat runtime environment
        const [deployer] = await ethers.getSigners();

        // Create contract instance
        const strategy = new ethers.Contract(config.strategyAddress, config.strategyAbi, deployer);

        // Call harvest
        const tx = await strategy.harvest();
        console.log("Harvest transaction sent. Waiting for confirmation...");

        await tx.wait();
        console.log("Harvest transaction confirmed!");

    } catch (error) {
        console.error(`Error calling harvest function: ${error.message}`);
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
