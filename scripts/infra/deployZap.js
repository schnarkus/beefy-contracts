import hardhat, { ethers } from "hardhat";
import { addressBook } from "blockchain-addressbook";

const {
  tokens: {
    ETH: { address: ETH },
  },
} = addressBook.arbitrum;

const zapParams = {
  router: "0xcDAeC65495Fa5c0545c5a405224214e3594f30d8",
  WETH: ETH,
};

const contractNames = {
  zap: "BeefyUniV2Zap",
};

async function main() {
  if (
    Object.values(zapParams).some(v => v === undefined) ||
    Object.values(contractNames).some(v => v === undefined)
  ) {
    console.error("one of config values undefined");
    return;
  }

  await hardhat.run("compile");

  const Zap = await ethers.getContractFactory(contractNames.zap);

  const zapConstructorArguments = [
    zapParams.router,
    zapParams.WETH,
  ];

  const zap = await Zap.deploy(...zapConstructorArguments);
  await zap.deployed();

  // add this info to PR
  console.log();
  console.log("Zap:", zap.address);
  console.log("Router:", zapParams.router);
  console.log("WETH:", zapParams.WETH);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

