import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import vaultV7 from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7.sol/BeefyVaultV7.json";
import vaultV7Factory from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7Factory.sol/BeefyVaultV7Factory.json";
import stratAbi from "../../artifacts/contracts/BIFI/strategies/Balancer/StrategyAuraGyroSideChainLP.sol/StrategyAuraGyroSideChainLP.json";

const {
  platforms: { balancer, beefyfinance },
  tokens: {
    BAL: { address: BAL },
    ETH: { address: ETH },
    arbUSDCe: { address: arbUSDCe },
    FRAX: { address: FRAX },
    sFRAX: { address: sFRAX },
    ARB: { address: ARB },
  },
} = addressBook.arbitrum;

const AURA = web3.utils.toChecksumAddress("0x1509706a6c66CA549ff0cB464de88231DDBe213B");
const want = web3.utils.toChecksumAddress("0xf8201D478418D6A67507e10880EaFAAaCD3230da");

const BPT = web3.utils.toChecksumAddress("0x423a1323c871abc9d89eb06855bf5347048fc4a5");

const vaultParams = {
  mooName: "Moo Aura Arb Gyroscope FRAX-sFRAX",
  mooSymbol: "mooAuraArbGyroscopeFRAX-sFRAX",
  delay: 21600,
};

const bytes0 = "0x0000000000000000000000000000000000000000000000000000000000000000";

const strategyParams = {
  want: want,
  nativeToLp0Route: [["0x64541216bafffeec8ea535bb71fbc927831d0595000100000000000000000002", 0, 1], ["0x423a1323c871abc9d89eb06855bf5347048fc4a5000000000000000000000496", 1, 2], ["0x2ce4457acac29da4736ae6f5cd9f583a6b335c270000000000000000000004dc", 2, 3], ["0xf8201d478418d6a67507e10880eafaaacd3230da000200000000000000000504", 3, 4]],
  lp0ToLp1Route: [["0xf8201d478418d6a67507e10880eafaaacd3230da000200000000000000000504", 0, 1]],
  outputToNativeRoute: [["0xcc65a812ce382ab909a11e434dbf75b34f1cc59d000200000000000000000001", 0, 1]],
  booster: "0x98Ef32edd24e2c92525E59afc4475C1242a30184",
  pid: 49,
  nativeToLp0: [ETH, arbUSDCe, BPT, sFRAX, FRAX],
  lp0ToLp1: [FRAX, sFRAX],
  outputToNative: [BAL, ETH],
  unirouter: balancer.router,
  strategist: process.env.STRATEGIST_ADDRESS,
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  beefyFeeConfig: beefyfinance.beefyFeeConfig,
  beefyVaultProxy: beefyfinance.vaultFactory,
  strategyImplementation: "0x3571Ea75Fd8c57670057a0a6Ff26B5b22a61521D",
  extraReward: true,
  secondExtraReward: true,
  rewardAssets: [AURA, BAL, ETH],
  rewardRoute: [
    ["0xbcaa6c053cab3dd73a2e898d89a4f84a180ae1ca000100000000000000000458", 0, 1],
    ["0xcc65a812ce382ab909a11e434dbf75b34f1cc59d000200000000000000000001", 1, 2],
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
    strategyParams.nativeToLp0Route,
    strategyParams.lp0ToLp1Route,
    strategyParams.outputToNativeRoute,
    strategyParams.booster,
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
