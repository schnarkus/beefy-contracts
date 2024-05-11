const hardhat = require("hardhat");

const config = {
    targetAddress: "0x83e1d2310Ade410676B1733d16e89f91822FD5c3",
    abi: [
        {
            "inputs": [],
            "name": "owner",
            "outputs": [
                {
                    "internalType": "address",
                    "name": "",
                    "type": "address"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        }
    ]
};

async function main() {
    await hardhat.run("compile");
    const { ethers } = hardhat;
    const contract = await ethers.getContractAt(config.abi, config.targetAddress);
    const owner = await contract.owner();

    console.log("Owner:", owner);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
