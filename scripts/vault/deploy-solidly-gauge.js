import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import { predictAddresses } from "../../utils/predictAddresses";

const {
  platforms: { beethovenx, beefyfinance },
  tokens: {
    BEETS: { address: BEETS },
    FTM: { address: FTM },
    USDC: { address: USDC },
    DEUS: { address: DEUS },
  },
} = addressBook.fantom;

const binSpiritGauge = web3.utils.toChecksumAddress("0x44e314190D9E4cE6d4C0903459204F8E21ff940A");

const vaultParams = {
  mooName: "Moo Beets Another DEI, another dollar",
  mooSymbol: "mooBeetsAnotherDEIAnotherDollar",
  delay: 21600,
};

const strategyParams = {
  balancerPoolIds: [
    "0x4e415957aa4fd703ad701e43ee5335d1d7891d8300020000000000000000053b",
    "0xcde5a11a4acb4ee4c805352cec57e236bdbc3837000200000000000000000019"],
  chefPoolId: 96,
  chef: beethovenx.masterchef,
  unirouter: beethovenx.router,
  gaugeStaker: binSpiritGauge,
  strategist: process.env.STRATEGIST_ADDRESS, // some address
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  beefyFeeConfig: beefyfinance.beefyFeeConfig,
  secondOutputToNativeRoute: [DEUS, FTM],
  nativeToInputRoute: [FTM, USDC],
  verifyStrat: true,
  spiritswapStrat: false,
  gaugeStakerStrat: false
};

const contractNames = {
  vault: "BeefyVaultV6",
  strategy: "StrategyBeethovenXDualRewards",
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

  const strategyConstructorArgumentsStaker = [
    strategyParams.want,
    strategyParams.gauge,
    strategyParams.gaugeStaker,
    [
      vault.address,
      strategyParams.unirouter,
      strategyParams.keeper,
      strategyParams.strategist,
      strategyParams.beefyFeeRecipient,
      strategyParams.beefyFeeConfig,
    ],
    strategyParams.outputToNativeRoute,
    strategyParams.outputToLp0Route,
    strategyParams.outputToLp1Route
  ];

  const strategyConstructorArguments = [
    strategyParams.balancerPoolIds,
    strategyParams.chefPoolId,
    strategyParams.chef,
    [
      vault.address,
      strategyParams.unirouter,
      strategyParams.keeper,
      strategyParams.strategist,
      strategyParams.beefyFeeRecipient,
      strategyParams.beefyFeeConfig,
    ],
    strategyParams.secondOutputToNativeRoute,
    strategyParams.nativeToInputRoute,
  ];

  const strategy = strategyParams.gaugeStakerStrat
    ? await Strategy.deploy(...strategyConstructorArgumentsStaker)
    : await Strategy.deploy(...strategyConstructorArguments);
  await strategy.deployed();

  // add this info to PR
  console.log();
  console.log("Vault:", vault.address);
  console.log("Strategy:", strategy.address);
  console.log("Want:", strategyParams.want);
  console.log("gauge:", strategyParams.gauge);

  console.log();
  console.log("Running post deployment");


  // await setPendingRewardsFunctionName(strategy, strategyParams.pendingRewardsFunctionName);
  await vault.transferOwnership(beefyfinance.vaultOwner);
  console.log(`Transfered Vault Ownership to ${beefyfinance.vaultOwner}`);

  if (strategyParams.spiritswapStrat) {
    console.log(`Setting Spirit Harvest to True`);
    await strategy.setSpiritHarvest(true);
  }


  if (strategyParams.verifyStrat) {
    console.log("verifying contract...")

    if (strategyParams.gaugeStakerStrat) {
      await hardhat.run("verify:verify", {
        address: strategy.address,
        constructorArguments: [
          ...strategyConstructorArgumentsStaker
        ],
      })
    } else {
      await hardhat.run("verify:verify", {
        address: strategy.address,
        constructorArguments: [
          ...strategyConstructorArguments
        ],
      })
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });