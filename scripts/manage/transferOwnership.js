const hardhat = require("hardhat");
const { addressBook } = require("blockchain-addressbook")

const { beefyfinance } = addressBook.arbitrum.platforms;

const ethers = hardhat.ethers;

const abi = ["function transferOwnership(address newOwner) public"];
const newOwner = beefyfinance.strategyOwner;
console.log('Transferring ownership to:', newOwner);

const contracts = [
  "0x1Bde043bD08D7bab4aE54741010448cfc6FCca12",
  "0x32f4640a66B25dA6F8b350Dcb5A3220CF6c9e68a",
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
