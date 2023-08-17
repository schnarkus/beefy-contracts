const hardhat = require("hardhat");
const ethers = hardhat.ethers;

const abi = ["function approve(address spender, uint value) external returns (bool)"];
const AnyswapV4Router = "0x1CcCA1cE62c62F7Be95d4A67722a8fDbed6EEcb4";
const tokens = ["0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83"];

console.log("Revoking...");

async function main() {
  for (const address of tokens) {
    try {
      const token = await ethers.getContractAt(abi, address);
      const tx = await token.approve(AnyswapV4Router, 0);
      await tx.wait();
      console.log(address, "done");
    } catch (error) {
      console.log(error.name);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
