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
    WMATIC: { address: WMATIC },
    ETH: { address: ETH },
    USDC: { address: USDC },
  },
} = addressBook.polygon;

const want = web3.utils.toChecksumAddress("0x4B7586A4F49841447150D3d92d9E9e000f766c30");

const vaultParams = {
  mooName: "Moo Balancer Polygon USDC/DAI/USDT",
  mooSymbol: "mooBalancerPolygonUSDC/DAI/USDT",
  delay: 21600,
};

const bytes0 = "0x0000000000000000000000000000000000000000000000000000000000000000";

const strategyParams = {
  want: want,
  isAura: false,
  pid: 42069,
  rewardsGauge: "0x07dAcD2229824D6Ff928181563745a573b026B3d",
  balSwapOn: false,
  inputIsComposable: true,
  nativeToInputRoute: [
    ["0x0297e37f1873d2dab4487aa67cd56b58e2f27875000100000000000000000002", 0, 1],
    ["0x1dcea0bfbbe6848f117640d534c9b60f41b9f2a8000100000000000000000ea1", 1, 2],
    ["0x4b7586a4f49841447150d3d92d9e9e000f766c30000000000000000000000e8a", 2, 3]
  ],
  outputToNativeRoute: [["0x0297e37f1873d2dab4487aa67cd56b58e2f27875000100000000000000000002", 0, 1]],
  nativeToInput: [WMATIC, ETH, USDC, want],
  outputToNative: [BAL, WMATIC],
  unirouter: balancer.router,
  strategist: process.env.STRATEGIST_ADDRESS,
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  beefyFeeConfig: beefyfinance.beefyFeeConfig,
  beefyVaultProxy: beefyfinance.vaultFactory,
  strategyImplementation: "0x8323e081138aac82c2AcbA843602d096B8fC9C8F",
  extraReward: false,
  secondExtraReward: true,
  rewardAssets: [AURA, ETH, WMATIC],
  rewardRoute: [
    ["0x40e57c0b2b674c8fbe5ba9e1e3bafce9f16f94be000200000000000000000e52", 0, 1],
    ["0x0297e37f1873d2dab4487aa67cd56b58e2f27875000100000000000000000002", 1, 2],
  ],
  secondRewardAssets: [USDC, ETH, WMATIC],
  secondRewardRoute: [
    ["0x1dcea0bfbbe6848f117640d534c9b60f41b9f2a8000100000000000000000ea1", 0, 1],
    ["0x0297e37f1873d2dab4487aa67cd56b58e2f27875000100000000000000000002", 1, 2],
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
      ethers.utils.solidityPack(["address", "uint24", "address"], [USDC, 500, WMATIC]),
      100
    );
    stratInitTx = await stratInitTx.wait();
    stratInitTx.status === 1
      ? console.log(`USDC Reward Added with tx: ${stratInitTx.transactionHash}`)
      : console.log(`USDC Reward Addition failed with tx: ${stratInitTx.transactionHash}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
