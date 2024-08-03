import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import vaultV7 from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7.sol/BeefyVaultV7.json";
import vaultV7Factory from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7Factory.sol/BeefyVaultV7Factory.json";
import stratAbi from "../../artifacts/contracts/BIFI/strategies/Balancer/StrategyAuraBalancer.sol/StrategyAuraBalancer.json";

const {
  platforms: { balancer, beefyfinance },
  tokens: {
    BAL: { address: BAL },
    AURA: { address: AURA },
    xDAI: { address: xDAI },
    USDT: { address: USDT },
    sDAI: { address: sDAI },
    wstETH: { address: wstETH },
  },
} = addressBook.gnosis;

const want = web3.utils.toChecksumAddress("0xfC095C811fE836Ed12f247BCf042504342B73FB7");

const vaultParams = {
  mooName: "Moo Aura Gnosis USDC.e/USDT/sDAI",
  mooSymbol: "mooAuraGnosisUSDC.e/USDT/sDAI",
  delay: 21600,
};

const bytes0 = "0x0000000000000000000000000000000000000000000000000000000000000000";
const zeroAddress = '0x0000000000000000000000000000000000000000';

const strategyParams = {
  want: want,
  isAura: true,
  pid: 27,
  rewardsGauge: zeroAddress,
  balSwapOn: false,
  inputIsComposable: true,
  nativeToInputRoute: [
    ["0x2086f52651837600180de173b09470f54ef7491000000000000000000000004f", 0, 1],
    ["0xfc095c811fe836ed12f247bcf042504342b73fb700000000000000000000009f", 1, 2],
  ],
  outputToNativeRoute: [
    ["0x00df7f58e1cf932ebe5f54de5970fb2bdf0ef06d00010000000000000000005b", 0, 1],
    ["0xbc2acf5e821c5c9f8667a36bb1131dad26ed64f9000200000000000000000063", 1, 2],
    ["0xfc095c811fe836ed12f247bcf042504342b73fb700000000000000000000009f", 2, 3],
    ["0x2086f52651837600180de173b09470f54ef7491000000000000000000000004f", 3, 4],
  ],
  nativeToInput: [xDAI, USDT, want],
  outputToNative: [BAL, wstETH, sDAI, USDT, xDAI],
  unirouter: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
  strategist: process.env.STRATEGIST_ADDRESS,
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  beefyFeeConfig: beefyfinance.beefyFeeConfig,
  beefyVaultProxy: beefyfinance.vaultFactory,
  strategyImplementation: "0x64D02377e3A28141c4E4663dC7F107dE010D4369",
  extraReward: true,
  secondExtraReward: false,
  rewardAssets: [AURA, wstETH, sDAI, USDT, xDAI],
  rewardRoute: [
    ["0x00df7f58e1cf932ebe5f54de5970fb2bdf0ef06d00010000000000000000005b", 0, 1],
    ["0xbc2acf5e821c5c9f8667a36bb1131dad26ed64f9000200000000000000000063", 1, 2],
    ["0xfc095c811fe836ed12f247bcf042504342b73fb700000000000000000000009f", 2, 3],
    ["0x2086f52651837600180de173b09470f54ef7491000000000000000000000004f", 3, 4],
  ],
  secondRewardAssets: [],
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
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
