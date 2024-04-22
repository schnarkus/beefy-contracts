const hardhat = require("hardhat");

async function main() {
  await hardhat.run("compile");

  const config = {
    targetAddress: "0x8eA4805A0652FF9Bc06311cB98c7178873B4b13C" // Target address for verification
  };

  await hardhat.run("verify:verify", {
    address: config.targetAddress,
    constructorArguments: [],
  });
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
