const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  const tokenAddress = "0x4Fd63966879300caFafBB35D157dC5229278Ed23";
  const spenderAddress = "0x21437E0a8244D79032B9a01BC635D85a55C82852";

  const tokenAbi = ["function approve(address spender, uint256 amount) external returns (bool)"];

  const Token = new hre.ethers.Contract(tokenAddress, tokenAbi, deployer);

  const amountInWei = hre.ethers.utils.parseEther("10");

  const approveTx = await Token.approve(spenderAddress, amountInWei);

  await approveTx.wait();

  console.log("Approved 10 ether worth of tokens for spender:", spenderAddress);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });