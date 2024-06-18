const hardhat = require("hardhat");

const config = {
    targetAddresses: [
        '0x2B4E2c73D82F1c489C15ac113D888B126D1a12F6'
    ],
    abi: [
        {
            "inputs": [{ "internalType": "address", "name": "_vault", "type": "address" }],
            "name": "setVault",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        }
    ]
};

async function main() {
    await hardhat.run("compile");

    const _vaultAddress = '0xc52393b27FeE4355Fe6a5DC92D25BC2Ed1B418Cb';

    for (const address of config.targetAddresses) {
        try {
            const contract = await ethers.getContractAt(config.abi, address);
            const tx = await contract.setVault(_vaultAddress);

            console.log(`setVault(${_vaultAddress}) transaction sent to ${address}. Waiting for confirmation...`);
            await tx.wait();
            console.log(`setVault(${_vaultAddress}) transaction confirmed for ${address}!`);
        } catch (error) {
            console.error(`Error processing address ${address}: ${error.message}`);
        }
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
