import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import { predictAddresses } from "../../utils/predictAddresses";

const {
  platforms: { beamswap, beefyfinance },
  tokens: {
    GLINT: { address: GLINT },
    GLMR: { address: GLMR },
    LDO: { address: LDO },
    wstDOT: { address: wstDOT },
    xcDOT: { address: xcDOT }
  },
} = addressBook.moonbeam;

const want = web3.utils.toChecksumAddress("0x79f05B32e29139C35Cd219aEDB5D99cedb1915aC");

const vaultParams = {
  mooName: "Moo Beamswap wstDOT-xcDOT",
  mooSymbol: "mooBeamswapwstDOT-xcDOT",
  delay: 21600,
};

const strategyParams = {
  want: want,
  poolId: 23,
  chef: beamswap.masterchef,
  unirouter: beamswap.router,
  keeper: beefyfinance.keeper,
  strategist: process.env.STRATEGIST_ADDRESS,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  beefyFeeConfig: beefyfinance.beefyFeeConfig,
  outputToNativeRoute: [GLINT, GLMR],
  nativeToLp0Route: [GLMR, xcDOT, wstDOT],
  nativeToLp1Route: [GLMR, xcDOT],
  rewardToNativeRoute: [LDO, GLMR]
};

const contractNames = {
  vault: "BeefyVaultV6",
  strategy: "StrategyBeamswapMultiRewardsLP",
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
    strategyParams.want,
    strategyParams.poolId,
    strategyParams.chef,
    [
      vault.address,
      strategyParams.unirouter,
      strategyParams.keeper,
      strategyParams.strategist,
      strategyParams.beefyFeeRecipient,
      strategyParams.beefyFeeConfig
    ],
    strategyParams.outputToNativeRoute,
    strategyParams.nativeToLp0Route,
    strategyParams.nativeToLp1Route
  ];

  const strategy = await Strategy.deploy(...strategyConstructorArguments);
  await strategy.deployed();

  // add this info to PR
  console.log();
  console.log("Vault:", vault.address);
  console.log("Strategy:", strategy.address);
  console.log("Want:", strategyParams.want);
  console.log("PoolId:", strategyParams.poolId);

  console.log(`Transferring Vault Owner to ${beefyfinance.vaultOwner}`)
  await vault.transferOwnership(beefyfinance.vaultOwner);

  console.log("Adding reward route:");
  await strategy.addRewardRoute(strategyParams.rewardToNativeRoute);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });