import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import vaultV7 from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7.sol/BeefyVaultV7.json";
import vaultV7Factory from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7Factory.sol/BeefyVaultV7Factory.json";
import stratAbi from "../../artifacts/contracts/BIFI/strategies/Balancer/StrategyAuraSideChainOmnichainSwap.sol/StrategyAuraSideChainOmnichainSwap.json";

const {
  platforms: { beethovenX, beefyfinance },
  tokens: {
    BAL: { address: BAL },
    ETH: { address: ETH },
    OP: { address: OP },
    opUSDCe: { address: opUSDCe },
  },
} = addressBook.optimism;

const AURA = web3.utils.toChecksumAddress("0x1509706a6c66CA549ff0cB464de88231DDBe213B");
const want = web3.utils.toChecksumAddress("0x9Da11Ff60bfc5aF527f58fd61679c3AC98d040d9");

const vaultParams = {
  mooName: "Moo Aura OP USDC/USDCe/USDT/DAI",
  mooSymbol: "mooAuraOPUSDC/USDCe/USDT/DAI",
  delay: 21600,
};

const bytes0 = "0x0000000000000000000000000000000000000000000000000000000000000000";

const strategyParams = {
  want: want,
  aura: AURA,
  inputIsComposable: true,
  nativeToInputRoute: [["0x39965c9dab5448482cf7e002f583c812ceb53046000100000000000000000003", 0, 1], ["0x9da11ff60bfc5af527f58fd61679c3ac98d040d9000000000000000000000100", 1, 2]],
  outputToNativeRoute: [["0xd6e5824b54f64ce6f1161210bc17eebffc77e031000100000000000000000006", 0, 1], ["0x39965c9dab5448482cf7e002f583c812ceb53046000100000000000000000003", 1, 2]],
  booster: "0x98Ef32edd24e2c92525E59afc4475C1242a30184",
  swapper: "0x98Cbcd43f28bc0a7Bf058191dBe3AD3bD9B49FE6",
  pid: 10,
  nativeToInput: [ETH, opUSDCe, want],
  outputToNative: [BAL, OP, ETH],
  unirouter: beethovenX.router,
  strategist: process.env.STRATEGIST_ADDRESS,
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  beefyFeeConfig: beefyfinance.beefyFeeConfig,
  beefyVaultProxy: beefyfinance.vaultFactory,
  strategyImplementation: "0x16Ab7178b1B062A326C007a52E32A67218151b59",
  extraReward: false,
  secondExtraReward: false,
  rewardAssets: [AURA, BAL, ETH],
  rewardRoute: [
    ["", 0, 1],
    ["", 1, 2],
  ],
  secondRewardAssets: [OP, ETH],
  secondRewardRoute: [["", 0, 1]],
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
    strategyParams.aura,
    strategyParams.inputIsComposable,
    strategyParams.nativeToInputRoute,
    strategyParams.outputToNativeRoute,
    strategyParams.booster,
    strategyParams.swapper,
    strategyParams.pid,
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
