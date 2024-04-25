const hardhat = require("hardhat");

const config = {
    targetAddress: "0xc1ecAD1D0Db5A997478f22492FAa2A209DD4F461",
    abi: [
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
    const contract = await ethers.getContractAt(config.abi, config.targetAddress);
    const tx = await contract.harvest();

    console.log("Harvest transaction sent. Waiting for confirmation...");
    await tx.wait();
    console.log("Harvest transaction confirmed!");
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
