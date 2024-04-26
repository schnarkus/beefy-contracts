import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import vaultV7 from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7.sol/BeefyVaultV7.json";
import vaultV7Factory from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7Factory.sol/BeefyVaultV7Factory.json";
import stratAbi from "../../artifacts/contracts/BIFI/strategies/Balancer/StrategyBalancerMultiReward.sol/StrategyBalancerMultiReward.json";
const { BigNumber } = ethers;

const RouterType = {
  BALANCER: BigNumber.from(0),
  UNISWAP_V2: BigNumber.from(1),
  UNISWAP_V3: BigNumber.from(2),
  TRADER_JOE: BigNumber.from(3),
};

const {
  platforms: { balancer, beefyfinance },
  tokens: {
    BAL: { address: BAL },
    AVAX: { address: AVAX },
    aQI: { address: aQI },
  },
} = addressBook.avax;

const want = web3.utils.toChecksumAddress("0xfD2620C9cfceC7D152467633B3B0Ca338D3d78cc");
const gauge = web3.utils.toChecksumAddress("0xf9aE6D2D56f02304f72dcC61694eAD0dC8DB51f7");

const pangolinRouter = web3.utils.toChecksumAddress("0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106");

const vaultParams = {
  mooName: "Moo Balancer Avax sAVAX-WAVAX",
  mooSymbol: "mooBalancerAvaxsAVAX-WAVAX",
  delay: 21600,
};

const strategyParams = {
  want: want,
  inputIsComposable: true,
  balSwapOn: true,
  nativeToInputRoute: [["0xfd2620c9cfcec7d152467633b3b0ca338d3d78cc00000000000000000000001c", 0, 1]],
  outputToNativeRoute: [["0xa39d8651689c8b6e5a9e0aa4362629aef2c58f55000200000000000000000038", 0, 1]],
  nativeToInputAssets: [AVAX, want],
  outputToNativeAssets: [BAL, AVAX],
  rewardsGauge: gauge,
  unirouter: balancer.router,
  strategist: process.env.STRATEGIST_ADDRESS,
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  beefyFeeConfig: beefyfinance.beefyFeeConfig,
  beefyVaultProxy: beefyfinance.vaultFactory,
  strategyImplementation: "0x8eA4805A0652FF9Bc06311cB98c7178873B4b13C",
  secondExtraReward: true,
  secondRewardAssets: [aQI, AVAX],
  secondRewardRoute: [["0x0000000000000000000000000000000000000000000000000000000000000000", 0, 1]],
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
      pangolinRouter,
      RouterType.UNISWAP_V2, // Use the enum value directly as a BigNumber
      strategyParams.secondRewardRoute,
      strategyParams.secondRewardAssets,
      [aQi, AVAX],
      [],
      0
    );
    stratInitTx = await stratInitTx.wait();
    stratInitTx.status === 1
      ? console.log(`QI Reward Added with tx: ${stratInitTx.transactionHash}`)
      : console.log(`QI Reward Addition failed with tx: ${stratInitTx.transactionHash}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
