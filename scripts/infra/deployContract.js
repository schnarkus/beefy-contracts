const hardhat = require("hardhat");
import { ethers } from "hardhat";
import { addressBook } from "blockchain-addressbook";

const {
  platforms: { beefyfinance },
  tokens: {
    MATIC: { address: MATIC },
  },
} = addressBook.polygon;

const contractName = "SimpleSwapper";

async function main() {
  await hardhat.run("compile");

  const Contract = await ethers.getContractFactory(contractName);

  // Add constructor arguments here
  const _native = MATIC
  const _keeper = beefyfinance.keeper

  // Deploying the contract with constructor arguments
  const contract = await Contract.deploy(_native, _keeper);
  await contract.deployed();

  console.log(`${contractName} deployed to:`, contract.address);

  // Verifying the deployed contract
  await hardhat.run("verify:verify", {
    address: contract.address,
    constructorArguments: [_native, _keeper],
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
