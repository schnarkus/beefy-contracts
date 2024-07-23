import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import vaultV7 from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7.sol/BeefyVaultV7.json";
import vaultV7Factory from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7Factory.sol/BeefyVaultV7Factory.json";
import stratAbi from "../../artifacts/contracts/BIFI/strategies/Balancer/StrategyAuraBalancer.sol/StrategyAuraBalancer.json";

const {
  platforms: { beethovenX, beefyfinance },
  tokens: {
    BAL: { address: BAL },
    ETH: { address: ETH },
    OP: { address: OP },
    wstETH: { address: wstETH },
  },
} = addressBook.optimism;

const AURA = web3.utils.toChecksumAddress("0x1509706a6c66CA549ff0cB464de88231DDBe213B");

const want = web3.utils.toChecksumAddress("0x2Bb4712247D5F451063b5E4f6948abDfb925d93D");

const vaultParams = {
  mooName: "Moo Aura OP wstETH-weETH",
  mooSymbol: "mooAuraOPwstETH-weETH",
  delay: 21600,
};

const bytes0 = "0x0000000000000000000000000000000000000000000000000000000000000000";
const zeroAddress = "0x0000000000000000000000000000000000000000";

const strategyParams = {
  want: want,
  isAura: true,
  pid: 25,
  rewardsGauge: zeroAddress,
  balSwapOn: false,
  inputIsComposable: true,
  nativeToInputRoute: [
    ["0x7ca75bdea9dede97f8b13c6641b768650cb837820002000000000000000000d5", 0, 1],
    ["0x2bb4712247d5f451063b5e4f6948abdfb925d93d000000000000000000000136", 1, 2],
  ],
  outputToNativeRoute: [["0xc38c2fc871188935b9c615e73b17f2e7e463c8b1000200000000000000000119", 0, 1]],
  nativeToInput: [ETH, wstETH, want],
  outputToNative: [BAL, ETH],
  unirouter: beethovenX.router,
  strategist: process.env.STRATEGIST_ADDRESS,
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  beefyFeeConfig: beefyfinance.beefyFeeConfig,
  beefyVaultProxy: beefyfinance.vaultFactory,
  strategyImplementation: "0x6742B83E4c0630739383BE00Ad14dEAD3bd8BbE1",
  extraReward: true,
  secondExtraReward: true,
  rewardAssets: [AURA, ETH],
  rewardRoute: [
    ["0x2f6b6973f38381fe453ea819b7e0f0897adeaae7000200000000000000000113", 0, 1],
  ],
  secondRewardAssets: [OP, ETH],
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
    strategyParams.isAura,
    strategyParams.pid,
    strategyParams.rewardsGauge,
    strategyParams.balSwapOn,
    strategyParams.inputIsComposable,
    strategyParams.nativeToInputRoute,
    strategyParams.outputToNativeRoute,
    strategyParams.nativeToInput,
    strategyParams.outputToNative,
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
      ? console.log(`AURA Reward Added with tx: ${stratInitTx.transactionHash}`)
      : console.log(`AURA Reward Addition failed with tx: ${stratInitTx.transactionHash}`);
  }

  if (strategyParams.secondExtraReward) {
    stratInitTx = await stratContract.addRewardToken(
      strategyParams.secondRewardAssets[0],
      [["0x0000000000000000000000000000000000000000000000000000000000000000", 0, 1]],
      ["0x0000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000000"],
      ethers.utils.solidityPack(["address", "uint24", "address"], [OP, 500, ETH]),
      100
    );
    stratInitTx = await stratInitTx.wait();
    stratInitTx.status === 1
      ? console.log(`OP Reward Added with tx: ${stratInitTx.transactionHash}`)
      : console.log(`OP Reward Addition failed with tx: ${stratInitTx.transactionHash}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
