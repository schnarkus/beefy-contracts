const hardhat = require("hardhat");

async function main() {
  await hardhat.run("compile");

  const config = {
    targetAddress: "0x51C7Ad5E551AF9F86e321a213c324e7F33192859" // Target address for verification
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
