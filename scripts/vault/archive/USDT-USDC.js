import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import { predictAddresses } from "../../utils/predictAddresses";

const registerSubsidy = require("../../utils/registerSubsidy");

const {
  platforms: { cone, beefyfinance },
  tokens: {
    CONE: { address: CONE },
    BNB: { address: BNB },
    USDT: { address: USDT },
    USDC: { address: USDC },
    BUSD: { address: BUSD },
  },
} = addressBook.bsc;

const want = web3.utils.toChecksumAddress("0x68ddA7c12f792E17C747A627d41153c103310D74");
const gauge = web3.utils.toChecksumAddress("0x32258f716720EA65d6ae11B0AaF1692CDefe6f9F");

const vaultParams = {
  mooName: "Moo Cone USDT-USDC",
  mooSymbol: "mooConeUSDT-USDC",
  delay: 21600,
};

const strategyParams = {
  want: want,
  gauge: gauge,
  unirouter: cone.router,
  gaugeStaker: cone.gaugeStaker,
  strategist: "0xfB41Cbf2ce16E8f626013a2F465521d27BA9a610",
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  feeConfig: beefyfinance.beefyFeeConfig,
  outputToNativeRoute: [[CONE, BNB, false]],
  outputToLp0Route: [
    [CONE, BNB, false],
    [BNB, BUSD, false],
    [BUSD, USDT, true],
  ],
  outputToLp1Route: [
    [CONE, BNB, false],
    [BNB, BUSD, false],
    [BUSD, USDC, true],
  ],
  verifyStrat: false,
};

const contractNames = {
  vault: "BeefyVaultV6",
  strategy: "StrategyCommonSolidlyStakerLP",
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
    strategyParams.gaugeStaker,
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
    strategyParams.outputToLp1Route,
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
  console.log(`Transfered Vault Ownership to ${beefyfinance.vaultOwner}`);

  if (hardhat.network.name === "bsc") {
    await registerSubsidy(vault.address, deployer);
    await registerSubsidy(strategy.address, deployer);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
