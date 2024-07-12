const hardhat = require("hardhat");

const config = {
    targetAddresses: [
        '0xD84f2DDC1C9789109e810e8f24c582c6Fb630368'
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

    const _vaultAddress = '0xA9Fa0C33cE278952309229FbE202A5E6108491B0';

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
