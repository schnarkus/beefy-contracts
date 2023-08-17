import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import vaultV7 from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7.sol/BeefyVaultV7.json";
import vaultV7Factory from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7Factory.sol/BeefyVaultV7Factory.json";
import stratAbi from "../../artifacts/contracts/BIFI/strategies/Balancer/StrategyBalancerComposableMultiRewardGaugeUniV3.sol/StrategyBalancerComposableMultiRewardGaugeUniV3.json";

const {
  platforms: { balancer, beefyfinance },
  tokens: {
    SD: { address: SD },
    BAL: { address: BAL },
    MATIC: { address: MATIC },
    MaticX: { address: MaticX },
  },
} = addressBook.polygon;

const bbaWMATIC = web3.utils.toChecksumAddress("0xE4885Ed2818Cc9E840A25f94F9b2A28169D1AEA7");

const want = web3.utils.toChecksumAddress("0xE78b25c06dB117fdF8F98583CDaaa6c92B79E917");
const gauge = web3.utils.toChecksumAddress("0xB0B28d7A74e62DF5F6F9E0d9Ae0f4e7982De9585");

const vaultParams = {
  mooName: "Moo Balancer BoostedAaveV3WMATIC-MaticX",
  mooSymbol: "mooBalancerBoostedAaveV3WMATIC-MaticX",
  delay: 21600,
};

const bytes0 = "0x0000000000000000000000000000000000000000000000000000000000000000";

const strategyParams = {
  unirouter: balancer.router,
  strategist: process.env.STRATEGIST_ADDRESS,
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  beefyFeeConfig: beefyfinance.beefyFeeConfig,
  isBeets: false,
  beefyVaultProxy: beefyfinance.vaultFactory,
  strategyImplementation: "0x42500360236BC0298b9F6982a1669A81F3A09761",
  extraReward: true,
  secondExtraReward: false,
  outputToNativeAssets: [BAL, MATIC],
  outputToNativeRouteBytes: [["0x0297e37f1873d2dab4487aa67cd56b58e2f27875000100000000000000000002", 0, 1]],
  nativeToWantAssets: [MATIC, bbaWMATIC, want],
  nativeToWantRouteBytes: [
    ["0xe4885ed2818cc9e840a25f94f9b2a28169d1aea7000000000000000000000b29", 0, 1],
    ["0xe78b25c06db117fdf8f98583cdaaa6c92b79e917000000000000000000000b2b", 1, 2],
  ],
  rewardAssets: [SD, MaticX, MATIC],
  rewardRoute: [
    ["0x4973f591784d9c94052a6c3ebd553fcd37bb0e5500020000000000000000087f", 0, 1],
    ["0xb20fc01d21a50d2c734c4a1262b4404d41fa7bf000000000000000000000075c", 1, 2],
  ],
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
    strategyParams.nativeToWantRouteBytes,
    strategyParams.outputToNativeRouteBytes,
    [strategyParams.outputToNativeAssets, strategyParams.nativeToWantAssets],
    gauge,
    strategyParams.isBeets,
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

  if (strategyParams.extraReward) {
    stratInitTx = await stratContract.addRewardToken(
      strategyParams.rewardAssets[0],
      strategyParams.rewardRoute,
      strategyParams.rewardAssets,
      bytes0,
      100
    );
    stratInitTx = await stratInitTx.wait();
    stratInitTx.status === 1
      ? console.log(`Reward Added with tx: ${stratInitTx.transactionHash}`)
      : console.log(`Reward Addition failed with tx: ${stratInitTx.transactionHash}`);
  }

  if (strategyParams.secondExtraReward) {
    stratInitTx = await stratContract.addRewardToken(
      strategyParams.secondRewardAssets[0],
      strategyParams.secondRewardRoute,
      strategyParams.secondRewardAssets,
      bytes0,
      100
    );
    stratInitTx = await stratInitTx.wait();
    stratInitTx.status === 1
      ? console.log(`Reward Added with tx: ${stratInitTx.transactionHash}`)
      : console.log(`Reward Addition failed with tx: ${stratInitTx.transactionHash}`);
  }
  // add this info to PR
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
