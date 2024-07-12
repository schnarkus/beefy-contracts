const hardhat = require("hardhat");

const config = {
    targetAddresses: [
        '0xD84f2DDC1C9789109e810e8f24c582c6Fb630368',
    ],
    abi: [
        {
            "inputs": [],
            "name": "unpause",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        }
    ]
};

async function main() {
    await hardhat.run("compile");

    for (const address of config.targetAddresses) {
        try {
            const contract = await ethers.getContractAt(config.abi, address);
            const tx = await contract.unpause();

            console.log(`Unpause transaction sent to ${address}. Waiting for confirmation...`);
            await tx.wait();
            console.log(`Unpause transaction confirmed for ${address}!`);
        } catch (error) {
            console.error(`Error processing address ${address}: ${error.message}`);
        }
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
