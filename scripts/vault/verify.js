const hardhat = require("hardhat");

async function main() {
  await hardhat.run("compile");

  const config = {
    targetAddress: "0xE62B9A7599b37D5576F14d42f2Ca191804fe09B3" // Target address for verification
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
