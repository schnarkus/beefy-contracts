import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import { predictAddresses } from "../../utils/predictAddresses";
import { setPendingRewardsFunctionName } from "../../utils/setPendingRewardsFunctionName";

const {
  platforms: { swapfish, beefyfinance },
  tokens: {
    FISH: { address: FISH },
    USDC: { address: USDC },
    ETH: { address: ETH },
    WBTC: { address: WBTC },
    MIM: { address: MIM },
    FRAX: { address: FRAX },
  },
} = addressBook.arbitrum;

const want = web3.utils.toChecksumAddress("0xbF90e103FFAdcaBcE03d42Ed921FF7a5c0b764eB");
const MAI = web3.utils.toChecksumAddress("0x3F56e0c36d275367b8C502090EDF38289b3dEa0d");

const vaultParams = {
  mooName: "Moo Fish MAI-USDC",
  mooSymbol: "mooFishMAI-USDC",
  delay: 21600,
};

const strategyParams = {
  want: want,
  poolId: 17,
  chef: swapfish.minichef,
  unirouter: swapfish.router,
  strategist: process.env.STRATEGIST_ADDRESS,
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  beefyFeeConfig: beefyfinance.beefyFeeConfig,
  outputToNativeRoute: [FISH, ETH],
  outputToLp0Route: [FISH, USDC, MAI],
  outputToLp1Route: [FISH, USDC],
  shouldSetPendingRewardsFunctionName: true,
  pendingRewardsFunctionName: "pendingCake", // used for rewardsAvailable(), use correct function name from masterchef
};

const contractNames = {
  vault: "BeefyVaultV6",
  strategy: "StrategyCommonChefLP",
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
    [vault.address,
    strategyParams.unirouter,
    strategyParams.keeper,
    strategyParams.strategist,
    strategyParams.beefyFeeRecipient,
    strategyParams.beefyFeeConfig],
    strategyParams.outputToNativeRoute,
    strategyParams.outputToLp0Route,
    strategyParams.outputToLp1Route
  ];
  const strategy = await Strategy.deploy(...strategyConstructorArguments);
  await strategy.deployed();

  // add this info to PR
  console.log();
  console.log("Vault:", vault.address);
  console.log("Strategy:", strategy.address);
  console.log("Want:", strategyParams.want);
  console.log("PoolId:", strategyParams.poolId);

  console.log();
  console.log("Running post deployment");

  if (strategyParams.shouldSetPendingRewardsFunctionName) {
    await setPendingRewardsFunctionName(strategy, strategyParams.pendingRewardsFunctionName);
  }

  console.log(`Transfering Vault Owner to ${beefyfinance.vaultOwner}`)
  await vault.transferOwnership(beefyfinance.vaultOwner);
  console.log();

}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });