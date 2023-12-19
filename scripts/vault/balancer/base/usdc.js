import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import vaultV7 from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7.sol/BeefyVaultV7.json";
import vaultV7Factory from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7Factory.sol/BeefyVaultV7Factory.json";
import stratAbi from "../../artifacts/contracts/BIFI/strategies/Balancer/StrategyBalancerMultiReward.sol/StrategyBalancerMultiReward.json";

// Import BigNumber from ethers
const { BigNumber } = ethers;

// Define the RouterType enum values
const RouterType = {
  BALANCER: BigNumber.from(0),
  UNISWAP_V2: BigNumber.from(1),
  UNISWAP_V3: BigNumber.from(2),
};

const {
  platforms: { balancer, beefyfinance },
  tokens: {
    ETH: { address: ETH },
    USDbC: { address: USDbC },
  },
} = addressBook.base;

const want = web3.utils.toChecksumAddress("0x0C659734f1eEF9C63B7Ebdf78a164CDd745586Db");
const gauge = web3.utils.toChecksumAddress("0x29B0C494eD7d098F4930428F115DcAf42a92392b");

const uniswapV3Router = web3.utils.toChecksumAddress("0x2626664c2603336E57B271c5C0b26F421741e481");
const BAL = web3.utils.toChecksumAddress("0x4158734D47Fc9692176B5085E0F52ee0Da5d47F1");
const stabal3 = web3.utils.toChecksumAddress("0x6FbFcf88DB1aADA31F34215b2a1Df7fafb4883e9");

const vaultParams = {
  mooName: "Moo Balancer Base USDC/USDbC/axlUSDC",
  mooSymbol: "mooBalancerBaseUSDC/USDbC/axlUSDC",
  delay: 21600,
};

const bytes0 = "0x0000000000000000000000000000000000000000000000000000000000000000";

const strategyParams = {
  want: want,
  inputIsComposable: true,
  balSwapOn: false,
  nativeToInputRoute: [["0x2db50a0e0310723ef0c2a165cb9a9f80d772ba2f00020000000000000000000d", 0, 1], ["0x6fbfcf88db1aada31f34215b2a1df7fafb4883e900000000000000000000000c", 1, 2], ["0x0c659734f1eef9c63b7ebdf78a164cdd745586db000000000000000000000046", 2, 3]],
  outputToNativeRoute: [["0x0000000000000000000000000000000000000000000000000000000000000000", 0, 1]],
  nativeToInputAssets: [ETH, stabal3, USDbC, want],
  outputToNativeAssets: [BAL, ETH],
  rewardsGauge: gauge,
  unirouter: balancer.router,
  strategist: process.env.STRATEGIST_ADDRESS,
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  beefyFeeConfig: beefyfinance.beefyFeeConfig,
  beefyVaultProxy: beefyfinance.vaultFactory,
  strategyImplementation: "0x0C62A89465D9b2546c43717eB228C62bD4A419B0",
  secondExtraReward: true,
  secondRewardAssets: [USDbC, ETH],
  secondRewardRoute: [["0x2db50a0e0310723ef0c2a165cb9a9f80d772ba2f00020000000000000000000d", 0, 1]],
};

async function main() {
  if (
    Object.values(vaultParams).some(v => v === undefined) ||
    Object.values(strategyParams).some(v => v === undefined)
  ) {
    console.error("one of config values undefined");
    return;
  }

  await hardhat.run("compile");

  console.log("Deploying:", vaultParams.mooName);

  const factory = await ethers.getContractAt(vaultV7Factory.abi, strategyParams.beefyVaultProxy);
  let vault = await factory.callStatic.cloneVault();
  let tx = await factory.cloneVault();
  tx = await tx.wait();
  tx.status === 1
    ? console.log(`Vault ${vault} is deployed with tx: ${tx.transactionHash}`)
    : console.log(`Vault ${vault} deploy failed with tx: ${tx.transactionHash}`);

  let strat = await factory.callStatic.cloneContract(strategyParams.strategyImplementation);
  let stratTx = await factory.cloneContract(
    strategyParams.composableStrat ? strategyParams.comStrategyImplementation : strategyParams.strategyImplementation
  );
  stratTx = await stratTx.wait();
  stratTx.status === 1
    ? console.log(`Strat ${strat} is deployed with tx: ${stratTx.transactionHash}`)
    : console.log(`Strat ${strat} deploy failed with tx: ${stratTx.transactionHash}`);

  const vaultConstructorArguments = [strat, vaultParams.mooName, vaultParams.mooSymbol, vaultParams.delay];

  const vaultContract = await ethers.getContractAt(vaultV7.abi, vault);
  let vaultInitTx = await vaultContract.initialize(...vaultConstructorArguments);
  vaultInitTx = await vaultInitTx.wait();
  vaultInitTx.status === 1
    ? console.log(`Vault Intilization done with tx: ${vaultInitTx.transactionHash}`)
    : console.log(`Vault Intilization failed with tx: ${vaultInitTx.transactionHash}`);

  vaultInitTx = await vaultContract.transferOwnership(beefyfinance.vaultOwner);
  vaultInitTx = await vaultInitTx.wait();
  vaultInitTx.status === 1
    ? console.log(`Vault OwnershipTransferred done with tx: ${vaultInitTx.transactionHash}`)
    : console.log(`Vault Intilization failed with tx: ${vaultInitTx.transactionHash}`);

  const strategyConstructorArguments = [
    want,
    strategyParams.inputIsComposable,
    strategyParams.balSwapOn,
    strategyParams.nativeToInputRoute,
    strategyParams.outputToNativeRoute,
    [
      strategyParams.outputToNativeAssets,
      strategyParams.nativeToInputAssets
    ],
    strategyParams.rewardsGauge,
    [
      vault,
      strategyParams.unirouter,
      strategyParams.keeper,
      strategyParams.strategist,
      strategyParams.beefyFeeRecipient,
      strategyParams.beefyFeeConfig,
    ],
  ];

  let abi = strategyParams.composableStrat ? stratComAbi.abi : stratAbi.abi;
  const stratContract = await ethers.getContractAt(abi, strat);
  let args = strategyParams.composableStrat ? comStrategyConstructorArguments : strategyConstructorArguments;
  let stratInitTx = await stratContract.initialize(...args);
  stratInitTx = await stratInitTx.wait();
  stratInitTx.status === 1
    ? console.log(`Strat Intilization done with tx: ${stratInitTx.transactionHash}`)
    : console.log(`Strat Intilization failed with tx: ${stratInitTx.transactionHash}`);

  if (strategyParams.secondExtraReward) {
    stratInitTx = await stratContract.addRewardToken(
      strategyParams.secondRewardAssets[0],
      uniswapV3Router,
      RouterType.UNISWAP_V3, // Use the enum value directly as a BigNumber
      [["0x0000000000000000000000000000000000000000000000000000000000000000", 0, 1]],
      ["0x0000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000000"],
      ethers.utils.solidityPack(["address", "uint24", "address"], [USDbC, 500, ETH]),
      100
    );
    stratInitTx = await stratInitTx.wait();
    stratInitTx.status === 1
      ? console.log(`USDbC Reward Added with tx: ${stratInitTx.transactionHash}`)
      : console.log(`USDbC Reward Addition failed with tx: ${stratInitTx.transactionHash}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
