const hardhat = require("hardhat");
const { addressBook } = require("blockchain-addressbook");

const { beefyfinance } = addressBook.bsc.platforms;

const ethers = hardhat.ethers;

const abi = ["function transferOwnership(address newOwner) public"];
const newOwner = beefyfinance.strategyOwner;
console.log("Transferring ownership to:", newOwner);

const contracts = ["0x1d9D3493F6B0011e7DF2bAE14dc72d1d72166D7f", "0xcEeBD2B8B76054B13C38b51B717fFF3C8b1231F7"];

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
