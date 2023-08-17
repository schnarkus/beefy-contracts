const hardhat = require("hardhat");
const { addressBook } = require("blockchain-addressbook");

const { beefyfinance } = addressBook.optimism.platforms;

const ethers = hardhat.ethers;

const abi = ["function transferOwnership(address newOwner) public"];
const newOwner = beefyfinance.strategyOwner;
console.log("Transferring ownership to:", newOwner);

const contracts = [
  "0x4210e17c73F1F3b704AC2E57A6fc3f390812ef8d",
  "0xe789Ff828eA77197c91a67f105dC1AF9A1699585",
  "0x2621Ff5C579eecbd210bF81467caf3DE7D664461",
  "0x59822BAD2F492D24856c7572efe64Cd8d372e4a1",
];

async function main() {
  for (const address of contracts) {
    const contract = await ethers.getContractAt(abi, address);
    const tx = await contract.transferOwnership(newOwner);
    await tx.wait();
    console.log(address, "done");
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
