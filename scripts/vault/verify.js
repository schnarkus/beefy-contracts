const hardhat = require("hardhat");

async function main() {
  await hardhat.run("compile");

  const config = {
    targetAddress: "0xa102D76565767aFB24cE70478F4058d0Fc73ef8A" // Target address for verification
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
