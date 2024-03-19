const hardhat = require("hardhat");

const ethers = hardhat.ethers;

const contractName = "StrategyAuraGyroSideChainLP";

async function main() {
  await hardhat.run("compile");

  const Contract = await ethers.getContractFactory(contractName);

  const contract = await Contract.deploy();
  await contract.deployed();

  console.log(`${contractName} deployed to:`, contract.address);

  await hardhat.run("verify:verify", {
    address: contract.address,
    constructorArguments: [],
  })
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });