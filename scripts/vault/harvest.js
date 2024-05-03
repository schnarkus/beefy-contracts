const hardhat = require("hardhat");

const config = {
    targetAddress: "0x20Eff9D9531CF43Fd4d100B26106AC62B146Ec3A",
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
