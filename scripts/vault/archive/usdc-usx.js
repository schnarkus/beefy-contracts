import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import { predictAddresses } from "../../utils/predictAddresses";

const {
  platforms: { velodrome, beefyfinance },
  tokens: {
    VELO: { address: VELO },
    USDC: { address: USDC },
    ETH: { address: ETH },
    USDT: { address: USDT },
    USX: { address: USX },
  },
} = addressBook.optimism;

const want = web3.utils.toChecksumAddress("0x5edac6B8EA08d535c01981D75B3361481C0EE999");
const gauge = web3.utils.toChecksumAddress("0xAEA343b1EF5ECfa0D252d7078425BaC047cf5d18");

const vaultParams = {
  mooName: "Moo Velo USDC-USX",
  mooSymbol: "mooVeloUSDC-USX",
  delay: 21600,
};

const strategyParams = {
  want: want,
  gauge: gauge,
  unirouter: velodrome.router,
  strategist: process.env.STRATEGIST_ADDRESS,
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  feeConfig: beefyfinance.beefyFeeConfig,
  outputToNativeRoute: [[VELO, USDC, false], [USDC, ETH, false]],
  outputToLp0Route: [[VELO, USDC, false]],
  outputToLp1Route: [[VELO, USDC, false], [USDC, USX, true]],
};

const contractNames = {
  vault: "BeefyVaultV6",
  strategy: "StrategyCommonSolidlyGaugeLP",
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
    strategyParams.gauge,
    [
      vault.address,
      strategyParams.unirouter,
      strategyParams.keeper,
      strategyParams.strategist,
      strategyParams.beefyFeeRecipient,
      strategyParams.feeConfig,
    ],
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
  console.log("gauge:", strategyParams.gauge);

  console.log();
  console.log("Running post deployment");

  await vault.transferOwnership(beefyfinance.vaultOwner);
  console.log(`Transferred Vault Ownership to ${beefyfinance.vaultOwner}`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });