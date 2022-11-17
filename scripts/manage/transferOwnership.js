const hardhat = require("hardhat");
const { addressBook } = require("blockchain-addressbook")

const { beefyfinance } = addressBook.optimism.platforms;

const ethers = hardhat.ethers;

const abi = ["function transferOwnership(address newOwner) public"];
const newOwner = beefyfinance.strategyOwner;
console.log('Transferring ownership to:', newOwner);

const contracts = [
  "0xFCe74fe54BA4B3428cAc457820A275240037dB92",
  "0x3B9292D78B0Aa958f2029e082Ed104096Dc20cd5"
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
