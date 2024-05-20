const hardhat = require("hardhat");

const config = {
    targetAddresses: [
        '0x558BDe303ae5C36536B0FB60D9311B2354B4411F',
        '0xCc8F6eE92BA32B926fBDa053333F4dE45842A4A6',
        '0x24E4538ED0AC083a870828236DAa2c0F95ae6b30',
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
