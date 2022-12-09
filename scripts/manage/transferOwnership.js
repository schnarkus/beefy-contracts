const hardhat = require("hardhat");
const { addressBook } = require("blockchain-addressbook")

const { beefyfinance } = addressBook.arbitrum.platforms;

const ethers = hardhat.ethers;

const abi = ["function transferOwnership(address newOwner) public"];
const newOwner = beefyfinance.strategyOwner;
console.log('Transferring ownership to:', newOwner);

const contracts = [
  "0xD80c8BBbb82121Af2e3DF77C4F2580c8cD99eBb5",
  "0x7f42ec8fF67E629a4ab674AEEb08fad9A32591AD",
  "0xE4a7A5b0df750904B31B939221AfFdEde09b7F8e"
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
