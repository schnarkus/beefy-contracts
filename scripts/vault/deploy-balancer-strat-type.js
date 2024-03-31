import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import vaultV7 from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7.sol/BeefyVaultV7.json";
import vaultV7Factory from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7Factory.sol/BeefyVaultV7Factory.json";
import stratAbi from "../../artifacts/contracts/BIFI/strategies/Balancer/StrategyAuraGyroSidechainOmnichainSwap.sol/StrategyAuraGyroSidechainOmnichainSwap.json";

const {
  platforms: { beethovenX, beefyfinance },
  tokens: {
    BAL: { address: BAL },
    ETH: { address: ETH },
    wstETH: { address: wstETH },
    sfrxETH: { address: sfrxETH },
    FRAX: { address: FRAX },
    sFRAX: { address: sFRAX },
    OP: { address: OP },
  },
} = addressBook.optimism;

const AURA = web3.utils.toChecksumAddress("0x1509706a6c66CA549ff0cB464de88231DDBe213B");
const want = web3.utils.toChecksumAddress("0xE906d4C4fC4c3Fe96560De86B4bf7eD89aF9A69a");

const vaultParams = {
  mooName: "Moo Aura OP Gyroscope Frax Symphony",
  mooSymbol: "mooAuraOPGyroscopeFraxSymphony",
  delay: 21600,
};

const strategyParams = {
  want: want,
  aura: AURA,
  nativeToLp0Route: [
    ["0x7ca75bdea9dede97f8b13c6641b768650cb837820002000000000000000000d5", 0, 1],
    ["0x5f8893506ddc4c271837187d14a9c87964a074dc000000000000000000000106", 1, 2],
    ["0x2feb76966459d7841fa8a7ed0aa4bf574d6111bf00020000000000000000011d", 2, 3],
  ],
  lp0ToLp1Route: [["0xe906d4c4fc4c3fe96560de86b4bf7ed89af9a69a000200000000000000000126", 0, 1]],
  outputToNativeRoute: [["0xc38c2fc871188935b9c615e73b17f2e7e463c8b1000200000000000000000119", 0, 1]],
  booster: "0x98Ef32edd24e2c92525E59afc4475C1242a30184",
  swapper: "0x98Cbcd43f28bc0a7Bf058191dBe3AD3bD9B49FE6",
  pid: 21,
  nativeToLp0: [ETH, wstETH, sfrxETH, sFRAX],
  lp0ToLp1: [sFRAX, FRAX],
  outputToNative: [BAL, ETH],
  unirouter: beethovenX.router,
  strategist: process.env.STRATEGIST_ADDRESS,
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  beefyFeeConfig: beefyfinance.beefyFeeConfig,
  beefyVaultProxy: beefyfinance.vaultFactory,
  strategyImplementation: "0x51C7Ad5E551AF9F86e321a213c324e7F33192859",
  secondExtraReward: true,
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
    strategyParams.aura,
    strategyParams.nativeToLp0Route,
    strategyParams.lp0ToLp1Route,
    strategyParams.outputToNativeRoute,
    strategyParams.booster,
    strategyParams.swapper,
    strategyParams.pid,
    strategyParams.nativeToLp0,
    strategyParams.lp0ToLp1,
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
