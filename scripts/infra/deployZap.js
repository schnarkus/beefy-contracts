
const { getContractAddress } = require("@openzeppelin/hardhat-upgrades/dist/utils");
const hardhat = require("hardhat");
const ethers = hardhat.ethers;

const contractName = "BeefyUniV2ZapSolidly";

async function main() {
  await hardhat.run("compile");

  const Contract = await ethers.getContractFactory(contractName);

  const params = [
    "0x2aa07920E4ecb4ea8C801D9DFEce63875623B285", // Router
    "0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83" // WETH
  ]

  const contract = await Contract.deploy(...params) ;
  await contract.deployed();
  console.log(`${contractName} deployed to:`, contract.address);

  await hardhat.run("verify:verify", {
    //change api key to chain
    address: contract.address,
    constructorArguments: [...params],
  });
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
