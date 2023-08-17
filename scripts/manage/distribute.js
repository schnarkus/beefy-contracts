const hardhat = require("hardhat");
const ethers = hardhat.ethers;

const abi = ["function transferFrom(address from, address to, uint256 tokenId) public"];
console.log("Sending...");

const token = "0x20c98e226C8B103d5e47d37B3Ae86c55b4EfD347";
const me = "0xce0ed27a22F5f34F110285C655D080B397a23BDc";

const tokenIds = [433];

const degens = ["0xfc5723d6bc8da7cadde437fe7cea54219ce97a67"];

async function main() {
  const contract = await ethers.getContractAt(abi, token);
  for (let i = 0; i < degens.length; i++) {
    const address = degens[i];
    const tokenId = tokenIds[i % tokenIds.length];
    try {
      const tx = await contract.transferFrom(me, address, tokenId);
      await tx.wait();
      console.log(`Token ${tokenId} transferred to ${address}`);
    } catch (error) {
      console.error(`Error transferring token to ${address}:`, error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
