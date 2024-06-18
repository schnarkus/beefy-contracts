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
            "name": "harvestOnDeposit",
            "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
            "stateMutability": "view",
            "type": "function"
        }
        // You can comment out the setHarvestOnDeposit function here
        // {
        //     "inputs": [{ "internalType": "bool", "name": "_harvestOnDeposit", "type": "bool" }],
        //     "name": "setHarvestOnDeposit",
        //     "outputs": [],
        //     "stateMutability": "nonpayable",
        //     "type": "function"
        // }
    ]
};

async function main() {
    await hardhat.run("compile");

    for (const address of config.targetAddresses) {
        try {
            const contract = await ethers.getContractAt(config.abi, address);
            const result = await contract.harvestOnDeposit();

            console.log(`harvestOnDeposit() called on ${address}: Result - ${result}`);
        } catch (error) {
            console.error(`Error processing address ${address}: ${error.message}`);
        }
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
