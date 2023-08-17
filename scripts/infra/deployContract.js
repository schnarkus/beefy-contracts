const { getContractAddress } = require("@openzeppelin/hardhat-upgrades/dist/utils");
const hardhat = require("hardhat");
const ethers = hardhat.ethers;

const contractName = "DGNAPES";

async function main() {
  await hardhat.run("compile");

  const Contract = await ethers.getContractFactory(contractName);

  const contract = await Contract.deploy("0xF9e1F4EEdE806FDA20f4084d9f9c4c2b36E38e77");
  await contract.deployed();
  console.log(`${contractName} deployed to:`, contract.address);

  await hardhat.run("verify:verify", {
    //change api key to chain
    address: contract.address,
    constructorArguments: ["0xF9e1F4EEdE806FDA20f4084d9f9c4c2b36E38e77"],
  });
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
