const hardhat = require("hardhat");

const config = {
    targetAddresses: [
        '0xf68A6697831FBA78f25CdFb1394b858fEd6F3659',
        '0x14bcD2bC6e516fa296636a55d1cc24fa89Cbc5B1',
        '0x63E495D7e87CF451d986D6E03015cD78b0CaEeda',
        '0xD4a88FDBdd57c465E125c0021b40f58eb86aA13E',
    ],
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

    for (const address of config.targetAddresses) {
        try {
            const contract = await ethers.getContractAt(config.abi, address);
            const tx = await contract.harvest();

            console.log(`Harvest transaction sent to ${address}. Waiting for confirmation...`);
            await tx.wait();
            console.log(`Harvest transaction confirmed for ${address}!`);
        } catch (error) {
            console.error(`Error processing address ${address}:`);
        }
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
