import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import { predictAddresses } from "../../utils/predictAddresses";

const {
  platforms: { velodrome, beefyfinance },
  tokens: {
    VELO: { address: VELO },
    USDC: { address: USDC },
    ETH: { address: ETH },
    wstETH: { address: wstETH },
  },
} = addressBook.optimism;

const USDPlus = web3.utils.toChecksumAddress("0x73cb180bf0521828d8849bc8CF2B920918e23032");
const LDO = web3.utils.toChecksumAddress("0xFdb794692724153d1488CcdBE0C56c252596735F");

const want = web3.utils.toChecksumAddress("0xfEdd5A17D009DCB28DEaC39094A2aA5b601DC4a3");
const gauge = web3.utils.toChecksumAddress("0x9237cBd5ba18c567bcE30671fF1D3252A35770bE");

const vaultParams = {
  mooName: "Moo Velodrome wstETH-LDO",
  mooSymbol: "mooVelodromewstETH-LDO",
  delay: 21600,
};

const strategyParams = {
  want: want,
  gauge: gauge,
  unirouter: velodrome.router,
  strategist: "0xfB41Cbf2ce16E8f626013a2F465521d27BA9a610",
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  feeConfig: beefyfinance.beefyFeeConfig,
  outputToNativeRoute: [
    [VELO, USDC, false],
    [USDC, ETH, false],
  ],
  outputToLp0Route: [
    [VELO, USDC, false],
    [USDC, ETH, false],
    [ETH, wstETH, true],
  ],
  outputToLp1Route: [
    [VELO, USDC, false],
    [USDC, ETH, false],
    [ETH, wstETH, true],
    [wstETH, LDO, false],
  ],
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
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
