const hardhat = require("hardhat");

async function main() {
  await hardhat.run("compile");

  const config = {
    targetAddress: "0x8fDD2Ee8C2C04170A37E6F02fD3C3e0236960049" // Target address for verification
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
