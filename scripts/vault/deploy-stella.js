import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import { predictAddresses } from "../../utils/predictAddresses";

const {
  platforms: { stellaswap, beefyfinance },
  tokens: {
    STELLA: { address: STELLA },
    GLMR: { address: GLMR },
    USDCwh: { address: USDCwh },
  },
} = addressBook.moonbeam;

const axlUSDC = web3.utils.toChecksumAddress("0xCa01a1D0993565291051daFF390892518ACfAD3A");
const want = web3.utils.toChecksumAddress("0xacb7dA459719EA26054D0481c5B3AE5903bd9906");

const vaultParams = {
  mooName: "Moo Stellaswap USDC-4pool",
  mooSymbol: "mooStellaswapUSDC-4pool",
  delay: 21600,
};

const strategyParams = {
  want: want,
  poolId: 34,
  chef: stellaswap.masterchefV1distributorV2,
  metapoolAndRouter: ["0xacb7dA459719EA26054D0481c5B3AE5903bd9906", "0xA1ffDc79f998E7fa91bA3A6F098b84c9275B0483"],
  basepoolAndRouter: ["0xB326b5189AA42Acaa3C649B120f084Ed8F4dCaA6", "0xB1BC9f56103175193519Ae1540A0A4572b1566F6"],
  unirouter: stellaswap.routerV1,
  keeper: beefyfinance.keeper,
  strategist: process.env.STRATEGIST_ADDRESS,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  beefyFeeConfig: beefyfinance.beefyFeeConfig,
  outputToNativeRoute: [STELLA, GLMR],
  outputToInputRoute: [STELLA, GLMR, USDCwh],
};

const contractNames = {
  vault: "BeefyVaultV6",
  strategy: "StrategySolarbeamMetaStable",
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
    strategyParams.metapoolAndRouter,
    strategyParams.basepoolAndRouter,
    [
      vault.address,
      strategyParams.unirouter,
      strategyParams.keeper,
      strategyParams.strategist,
      strategyParams.beefyFeeRecipient,
      strategyParams.beefyFeeConfig
    ],
    strategyParams.outputToNativeRoute,
    strategyParams.outputToInputRoute
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
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });