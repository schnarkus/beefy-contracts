const { getContractAddress } = require("@openzeppelin/hardhat-upgrades/dist/utils");
const hardhat = require("hardhat");
const { startingEtherPerAccount } = require("../../utils/configInit");

const ethers = hardhat.ethers;

const contractName = "StrategyBalancerMultiReward";
const address = "0xfdade480a80b6e8704be8b9a2900652cef895220";

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