const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  const tokenAddress = "0x9791d590788598535278552EEcD4b211bFc790CB";
  const spenderAddress = "0x85B10228cd93A6e5E354Ff0f2c60875E8E62F65A";

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