const { getContractAddress } = require("@openzeppelin/hardhat-upgrades/dist/utils");
const hardhat = require("hardhat");
const { startingEtherPerAccount } = require("../../utils/configInit");

const ethers = hardhat.ethers;

const contractName = "StrategyBalancerMultiReward";

const config = {};

async function main() {
  await hardhat.run("compile");

  const Contract = await ethers.getContractFactory(contractName);

  const contract = await Contract.deploy();
  await contract.deployed();

  console.log(`${contractName} deployed to:`, contract.address);

  await hardhat.run("verify:verify", {
    address: contract.address,
    constructorArguments: [
      ...params
    ],
  })
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });