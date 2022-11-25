import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import vaultV7 from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7.sol/BeefyVaultV7.json";
import vaultV7Factory from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7Factory.sol/BeefyVaultV7Factory.json";
import stratAbi from "../../artifacts/contracts/BIFI/strategies/Beethovenx/StrategyBeetsComposableMultiRewardGaugeUniV3.sol/StrategyBeetsComposableMultiRewardGaugeUniV3.json";

const {
  platforms: { beethovenX, beefyfinance },
  tokens: {
    ETH: { address: ETH },
    rETH: { address: rETH },
    USDC: { address: USDC },
  },
} = addressBook.optimism;

const USDPlus = web3.utils.toChecksumAddress("0x73cb180bf0521828d8849bc8CF2B920918e23032");
const want = web3.utils.toChecksumAddress("0xb1C9aC57594e9B1EC0f3787D9f6744EF4CB0A024");
const gauge = web3.utils.toChecksumAddress("0xa066243Ba7DAd6C779caA1f9417910a4AE83cf4D");

const vaultParams = {
  mooName: "Moo Beets Overnight Pulse",
  mooSymbol: "mooBeetsOvernightPulse",
  delay: 21600,
};

const strategyParams = {
  nativeToWantRoute: [
    ["0x4fd63966879300cafafbb35d157dc5229278ed2300020000000000000000002b", 0, 1],
    ["0xb0de49429fbb80c635432bbad0b3965b2856017700010000000000000000004e", 1, 2],
    ["0xb1c9ac57594e9b1ec0f3787d9f6744ef4cb0a02400000000000000000000006e", 2, 3]
  ],
  outputToNativeRoute: [
    ["0xb1c9ac57594e9b1ec0f3787d9f6744ef4cb0a02400000000000000000000006e", 0, 1],
    ["0xb0de49429fbb80c635432bbad0b3965b2856017700010000000000000000004e", 1, 2],
    ["0x4fd63966879300cafafbb35d157dc5229278ed2300020000000000000000002b", 2, 3]
  ],
  nativeToWant: [ETH, rETH, USDC, want],
  outputToNative: [USDPlus, USDC, rETH, ETH],
  rewardsGauge: gauge,
  unirouter: beethovenX.router,
  strategist: process.env.STRATEGIST_ADDRESS,
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  beefyFeeConfig: beefyfinance.beefyFeeConfig,
  beefyVaultProxy: "???", //whots this
  strategyImplementation: "???",
}

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
  let stratTx = await factory.cloneContract(strategyParams.strategyImplementation);
  stratTx = await stratTx.wait();
  stratTx.status === 1
    ? console.log(`Strat ${strat} is deployed with tx: ${stratTx.transactionHash}`)
    : console.log(`Strat ${strat} deploy failed with tx: ${stratTx.transactionHash}`);

  const vaultConstructorArguments = [
    strat,
    vaultParams.mooName,
    vaultParams.mooSymbol,
    vaultParams.delay,
  ];

  const vaultContract = await ethers.getContractAt(vaultV7.abi, vault);
  let vaultInitTx = await vaultContract.initialize(...vaultConstructorArguments);
  vaultInitTx = await vaultInitTx.wait()
  vaultInitTx.status === 1
    ? console.log(`Vault Intilization done with tx: ${vaultInitTx.transactionHash}`)
    : console.log(`Vault Intilization failed with tx: ${vaultInitTx.transactionHash}`);

  vaultInitTx = await vaultContract.transferOwnership(beefyfinance.vaultOwner);
  vaultInitTx = await vaultInitTx.wait()
  vaultInitTx.status === 1
    ? console.log(`Vault OwnershipTransfered done with tx: ${vaultInitTx.transactionHash}`)
    : console.log(`Vault Intilization failed with tx: ${vaultInitTx.transactionHash}`);

  const strategyConstructorArguments = [
    strategyParams.nativeToWantRoute,
    strategyParams.outputToNativeRoute,
    strategyParams.nativeToWant,
    strategyParams.outputToNative,
    strategyParams.rewardsGauge,
    [
      vault,
      strategyParams.unirouter,
      strategyParams.keeper,
      strategyParams.strategist,
      strategyParams.beefyFeeRecipient,
      strategyParams.beefyFeeConfig
    ],
  ];

  //console.log(...strategyConstructorArguments);

  const stratContract = await ethers.getContractAt(stratAbi.abi, strat);
  let stratInitTx = await stratContract.initialize(...strategyConstructorArguments);
  stratInitTx = await stratInitTx.wait()
  stratInitTx.status === 1
    ? console.log(`Strat Intilization done with tx: ${stratInitTx.transactionHash}`)
    : console.log(`Strat Intilization failed with tx: ${stratInitTx.transactionHash}`);
  // add this info to PR
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });