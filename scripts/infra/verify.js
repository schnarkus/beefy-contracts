const { getContractAddress } = require("@openzeppelin/hardhat-upgrades/dist/utils");
const hardhat = require("hardhat");
const { startingEtherPerAccount } = require("../../utils/configInit");

const ethers = hardhat.ethers;

const contractName = "StrategyAuraSideChain";
const address = "0xaa01fcf32dbf4b6d539e724ec5d88589db9d2228";

async function main() {
    await hardhat.run("compile");

    await hardhat.run("verify:verify", {
        address: address,
        constructorArguments: [
        ],
    })
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });