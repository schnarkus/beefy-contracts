const hardhat = require("hardhat");
const { addressBook } = require("blockchain-addressbook")

const { beefyfinance } = addressBook.arbitrum.platforms;

const ethers = hardhat.ethers;

const abi = ["function transferOwnership(address newOwner) public"];
const newOwner = beefyfinance.strategyOwner;
console.log('Transferring ownership to:', newOwner);

const contracts = [
  "0xbc5654D881620b844f2d1B21E3480d980B28D01b",
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
