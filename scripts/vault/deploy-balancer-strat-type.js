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
    ETH: { address: ETH },
    ARB: { address: ARB },
    wstETH: { address: wstETH },
  },
} = addressBook.arbitrum;

const want = web3.utils.toChecksumAddress("0x7967FA58B9501600D96bD843173b9334983EE6E6");

const vaultParams = {
  mooName: "Dummy",
  mooSymbol: "Dummy",
  delay: 21600,
};

const bytes0 = "0x0000000000000000000000000000000000000000000000000000000000000000";

const strategyParams = {
  want: want,
  isAura: true,
  pid: 68,
  rewardsGauge: "0x96d7C70c80518Ee189CB6ba672FbD22E4fDD9c19",
  balSwapOn: false,
  nativeToLp0Route: [["0x7967fa58b9501600d96bd843173b9334983ee6e600020000000000000000056e", 0, 1]],
  lp0ToLp1Route: [["0x7967fa58b9501600d96bd843173b9334983ee6e600020000000000000000056e", 0, 1]],
  outputToNativeRoute: [["0xcc65a812ce382ab909a11e434dbf75b34f1cc59d000200000000000000000001", 0, 1]],
  nativeToLp0Assets: [ETH, wstETH],
  lp0ToLp1Assets: [wstETH, ETH],
  outputToNativeAssets: [BAL, ETH],
  unirouter: balancer.router,
  strategist: process.env.STRATEGIST_ADDRESS,
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  beefyFeeConfig: beefyfinance.beefyFeeConfig,
  beefyVaultProxy: beefyfinance.vaultFactory,
  strategyImplementation: "0xc32a03b36D6330588270e5d09cDA9Fd9abc8267d",
  extraReward: true,
  secondExtraReward: true,
  rewardAssets: [AURA, ETH],
  rewardRoute: [
    ["0x64abeae398961c10cbb50ef359f1db41fc3129ff000200000000000000000526", 0, 1],
  ],
  secondRewardAssets: [ARB, ETH],
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

  if (strategyParams.secondExtraReward) {
    stratInitTx = await stratContract.addRewardToken(
      strategyParams.secondRewardAssets[0],
      [["0x0000000000000000000000000000000000000000000000000000000000000000", 0, 1]],
      ["0x0000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000000"],
      ethers.utils.solidityPack(["address", "uint24", "address"], [ARB, 500, ETH]),
      100
    );
    stratInitTx = await stratInitTx.wait();
    stratInitTx.status === 1
      ? console.log(`ARB Reward Added with tx: ${stratInitTx.transactionHash}`)
      : console.log(`ARB Reward Addition failed with tx: ${stratInitTx.transactionHash}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
