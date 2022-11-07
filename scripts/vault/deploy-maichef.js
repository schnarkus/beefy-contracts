import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import { predictAddresses } from "../../utils/predictAddresses";

const {
  platforms: { beethovenx, beefyfinance },
  tokens: {
    QI: { address: QI },
    WFTM: { address: WFTM },
    USDC: { address: USDC },
  },
} = addressBook.fantom;

const vaultParams = {
  mooName: "Moo Mai FTM-QI",
  mooSymbol: "mooMaiFTM-QI",
  delay: 21600,
};

const strategyParams = {
  balancerPoolIds: [
    "0x7ae6a223cde3a17e0b95626ef71a2db5f03f540a00020000000000000000008a",
    "0x7ae6a223cde3a17e0b95626ef71a2db5f03f540a00020000000000000000008a",
    "0x7ae6a223cde3a17e0b95626ef71a2db5f03f540a00020000000000000000008a",
    "0x7ae6a223cde3a17e0b95626ef71a2db5f03f540a00020000000000000000008a",
  ],
  chefPoolId: 1, // 0 for stable pool
  chef: "0x230917f8a262bF9f2C3959eC495b11D1B7E1aFfC",
  input: QI,
  unirouter: beethovenx.router,
  keeper: beefyfinance.keeper,
  strategist: process.env.STRATEGIST_ADDRESS,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  beefyFeeConfig: beefyfinance.beefyFeeConfig,
};

const contractNames = {
  vault: "BeefyVaultV6",
  strategy: "StrategyMaiChefLPBeethovenx",
};

async function main() {
  if (
    Object.values(vaultParams).some(v => v === undefined) ||
    Object.values(strategyParams).some(v => v === undefined) ||
    Object.values(contractNames).some(v => v === undefined)
  ) {
    console.error("one of config values undefined");
    return;
  }

  await hardhat.run("compile");

  const Vault = await ethers.getContractFactory(contractNames.vault);
  const Strategy = await ethers.getContractFactory(contractNames.strategy);

  const [deployer] = await ethers.getSigners();

  console.log("Deploying:", vaultParams.mooName);

  const predictedAddresses = await predictAddresses({ creator: deployer.address });

  const vaultConstructorArguments = [
    predictedAddresses.strategy,
    vaultParams.mooName,
    vaultParams.mooSymbol,
    vaultParams.delay,
  ];
  const vault = await Vault.deploy(...vaultConstructorArguments);
  await vault.deployed();

  const strategyConstructorArguments = [
    strategyParams.balancerPoolIds,
    strategyParams.chefPoolId,
    strategyParams.chef,
    strategyParams.input,
    [
      vault.address,
      strategyParams.unirouter,
      strategyParams.keeper,
      strategyParams.strategist,
      strategyParams.beefyFeeRecipient,
      strategyParams.beefyFeeConfig,
    ],
  ];
  const strategy = await Strategy.deploy(...strategyConstructorArguments);
  await strategy.deployed();

  // add this info to PR
  console.log();
  console.log("Vault:", vault.address);
  console.log("Strategy:", strategy.address);
  console.log("Want:", strategyParams.want);
  console.log("PoolId:", strategyParams.chefPoolId);

  console.log();
  console.log("Running post deployment");

  if (strategyParams.shouldSetPendingRewardsFunctionName) {
    await setPendingRewardsFunctionName(strategy, strategyParams.pendingRewardsFunctionName);
  }

  console.log(`Transfering Vault Owner to ${beefyfinance.vaultOwner}`);
  await vault.transferOwnership(beefyfinance.vaultOwner);
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
