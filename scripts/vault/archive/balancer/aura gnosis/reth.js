import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import vaultV7 from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7.sol/BeefyVaultV7.json";
import vaultV7Factory from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7Factory.sol/BeefyVaultV7Factory.json";
import stratAbi from "../../artifacts/contracts/BIFI/strategies/Balancer/StrategyAuraBalancerGyro.sol/StrategyAuraBalancerGyro.json";

const {
  platforms: { balancer, beefyfinance },
  tokens: {
    BAL: { address: BAL },
    AURA: { address: AURA },
    xDAI: { address: xDAI },
    USDT: { address: USDT },
    sDAI: { address: sDAI },
    WETH: { address: WETH },
    wstETH: { address: wstETH },
  },
} = addressBook.gnosis;

const want = web3.utils.toChecksumAddress("0x71E1179C5e197FA551BEEC85ca2EF8693c61b85b");
const rETH = web3.utils.toChecksumAddress("0xc791240D1F2dEf5938E2031364Ff4ed887133C3d");

const vaultParams = {
  mooName: "Moo Aura Gnosis WETH-rETH",
  mooSymbol: "mooAuraGnosisWETH-rETH",
  delay: 21600,
};

const bytes0 = "0x0000000000000000000000000000000000000000000000000000000000000000";
const zeroAddress = '0x0000000000000000000000000000000000000000';

const strategyParams = {
  want: want,
  isAura: true,
  pid: 26,
  rewardsGauge: zeroAddress,
  balSwapOn: false,
  nativeToLp0Route: [
    ["0x2086f52651837600180de173b09470f54ef7491000000000000000000000004f", 0, 1],
    ["0xfc095c811fe836ed12f247bcf042504342b73fb700000000000000000000009f", 1, 2],
    ["0xbc2acf5e821c5c9f8667a36bb1131dad26ed64f9000200000000000000000063", 2, 3],
    ["0x8dd4df4ce580b9644437f3375e54f1ab0980822800020000000000000000009c", 3, 4],
  ],
  lp0ToLp1Route: [["0x71e1179c5e197fa551beec85ca2ef8693c61b85b0002000000000000000000a0", 0, 1]],
  outputToNativeRoute: [
    ["0x00df7f58e1cf932ebe5f54de5970fb2bdf0ef06d00010000000000000000005b", 0, 1],
    ["0xbc2acf5e821c5c9f8667a36bb1131dad26ed64f9000200000000000000000063", 1, 2],
    ["0xfc095c811fe836ed12f247bcf042504342b73fb700000000000000000000009f", 2, 3],
    ["0x2086f52651837600180de173b09470f54ef7491000000000000000000000004f", 3, 4],
  ],
  nativeToLp0Assets: [xDAI, USDT, sDAI, wstETH, WETH],
  lp0ToLp1Assets: [WETH, rETH],
  outputToNativeAssets: [BAL, wstETH, sDAI, USDT, xDAI],
  unirouter: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
  strategist: process.env.STRATEGIST_ADDRESS,
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  beefyFeeConfig: beefyfinance.beefyFeeConfig,
  beefyVaultProxy: beefyfinance.vaultFactory,
  strategyImplementation: "0xb451E7C51a41be2f29DD68FF70f178B93af38197",
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
    strategyParams.nativeToLp0Route,
    strategyParams.lp0ToLp1Route,
    strategyParams.outputToNativeRoute,
    strategyParams.nativeToLp0Assets,
    strategyParams.lp0ToLp1Assets,
    strategyParams.outputToNativeAssets,
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
