import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import vaultV7 from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7.sol/BeefyVaultV7.json";
import vaultV7Factory from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7Factory.sol/BeefyVaultV7Factory.json";
import stratAbi from "../../artifacts/contracts/BIFI/strategies/Beethovenx/StrategyBeethovenXComposableAnkr.sol/StrategyBeethovenXComposableAnkr.json";

const {
  platforms: { beethovenx, beefyfinance },
  tokens: {
    FTM: { address: FTM },
    ANKR: { address: ANKR },
    ankrFTM: { address: ankrFTM },
  },
} = addressBook.fantom;

const want = web3.utils.toChecksumAddress("0x723d43bd1A1ff40DeaaB77a164B5c3eA4F654DB2");

const vaultParams = {
  mooName: "Moo Beets Ankr Fantom Liquid Mosaic",
  mooSymbol: "mooBeetsAnkrFantomLiquidMosaic",
  delay: 21600,
};

const strategyParams = {
  chefPoolId: 124,
  outputSwapPoolId: ["0x9e4341acef4147196e99d648c5e43b3fc9d026780002000000000000000005ec"],
  toNativeSwapPoolId: ["0x723d43bd1a1ff40deaab77a164b5c3ea4f654db2000000000000000000000750"],
  rewardToAnkrFTMRoute: [[ANKR, ankrFTM, false]],
  nativeToWantRoute: [["0x723d43bd1a1ff40deaab77a164b5c3ea4f654db2000000000000000000000750", 0, 1]],
  nativeToWantAssets: [FTM, want],
  unirouter: beethovenx.router,
  keeper: beefyfinance.keeper,
  strategist: process.env.STRATEGIST_ADDRESS,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  beefyFeeConfig: beefyfinance.beefyFeeConfig,
  beefyVaultProxy: beefyfinance.vaultFactory,
  strategyImplementation: "0x6fA1A21a6756084d0A1704871021BD05fB99a0b2",
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
  let stratTx = await factory.cloneContract(strategyParams.strategyImplementation);
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
    strategyParams.chefPoolId,
    strategyParams.outputSwapPoolId,
    strategyParams.toNativeSwapPoolId,
    strategyParams.rewardToAnkrFTMRoute,
    strategyParams.nativeToWantRoute,
    strategyParams.nativeToWantAssets,
    [
      vault,
      strategyParams.unirouter,
      strategyParams.keeper,
      strategyParams.strategist,
      strategyParams.beefyFeeRecipient,
      strategyParams.beefyFeeConfig,
    ],
  ];

  console.log(strategyConstructorArguments);

  let abi = stratAbi.abi;
  const stratContract = await ethers.getContractAt(abi, strat);
  let args = strategyConstructorArguments;
  let stratInitTx = await stratContract.initialize(...args);
  stratInitTx = await stratInitTx.wait();
  stratInitTx.status === 1
    ? console.log(`Strat Intilization done with tx: ${stratInitTx.transactionHash}`)
    : console.log(`Strat Intilization failed with tx: ${stratInitTx.transactionHash}`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
