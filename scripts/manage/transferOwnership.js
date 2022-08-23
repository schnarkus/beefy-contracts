const hardhat = require("hardhat");
const { addressBook } = require("blockchain-addressbook");

const { beefyfinance } = addressBook.moonbeam.platforms;

const ethers = hardhat.ethers;

const abi = ["function transferOwnership(address newOwner) public"];
const newOwner = beefyfinance.strategyOwner;
console.log("Transferring ownership to:", newOwner);

const contracts = ["0x3b8cc0191FdCb6B022ecCeFeeF1EC8a66bF721Ff"];

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
