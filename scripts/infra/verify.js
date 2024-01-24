const { getContractAddress } = require("@openzeppelin/hardhat-upgrades/dist/utils");
const hardhat = require("hardhat");
const { startingEtherPerAccount } = require("../../utils/configInit");

const ethers = hardhat.ethers;

const contractName = "StrategyBalancerMultiRewardChefUniV2";
const address = "0x48F758a1d39f6fFae3C94f14FCe8b7064a700b95";

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