import hardhat, { ethers, } from "hardhat";

async function main() {
  await hardhat.run("compile");

  //first deploy an instance
  const BeefyVaultV7 = await ethers.getContractFactory("BeefyVaultV7");
  console.log("Deploying: BeefyVaultV7");
  const beefyVaultV7 = await BeefyVaultV7.deploy();
  await beefyVaultV7.deployed();
  console.log("BeefyVaultV7", beefyVaultV7.address);

  //then deploy the factory with that instance
  const BeefyVaultV7Factory = await ethers.getContractFactory("BeefyVaultV7Factory");
  console.log("Deploying: BeefyVaultV7Factory");
  const beefyVaultV7Factory = await BeefyVaultV7Factory.deploy(beefyVaultV7.address);
  await beefyVaultV7Factory.deployed();
  console.log("BeefyVaultV7Factory", beefyVaultV7Factory.address);

  await hardhat.run("verify:verify", {
    address: beefyVaultV7Factory.address,
    constructorArguments: [beefyVaultV7.address],
  })
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });