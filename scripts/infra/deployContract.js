const hardhat = require("hardhat");
import { ethers } from "hardhat";

const contractName = "StrategyAuraSideChain";

async function main() {
  await hardhat.run("compile");

  const Contract = await ethers.getContractFactory(contractName);

  // Deploying the contract with constructor arguments
  const contract = await Contract.deploy();
  await contract.deployed();

  console.log(`${contractName} deployed to:`, contract.address);

  // Verifying the deployed contract
  await hardhat.run("verify:verify", {
    address: contract.address,
    constructorArguments: [],
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
