const hardhat = require("hardhat");

const config = {
    targetAddresses: [
        '0x2706d38D63F1D3c3FDb8bd3d4D34cCDFf88161bB',
        '0x95e24537456e5A090B43A6aDe16795F718bDADFB',
        '0x2B4E2c73D82F1c489C15ac113D888B126D1a12F6',
    ],
    abi: [
        {
            "inputs": [],
            "name": "panic",
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
            const tx = await contract.panic();

            console.log(`Panic transaction sent to ${address}. Waiting for confirmation...`);
            await tx.wait();
            console.log(`Panic transaction confirmed for ${address}!`);
        } catch (error) {
            console.error(`Error processing address ${address}: ${error.message}`);
        }
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
