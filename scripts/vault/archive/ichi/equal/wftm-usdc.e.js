import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import vaultV7 from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7.sol/BeefyVaultV7.json";
import vaultV7Factory from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7Factory.sol/BeefyVaultV7Factory.json";
import stratAbi from "../../artifacts/contracts/BIFI/strategies/Common/StrategyEqualizerIchi.sol/StrategyEqualizerIchi.json";

const {
  platforms: { equalizer, beefyfinance },
  tokens: {
    FTM: { address: FTM },
    EQUAL: { address: EQUAL },
    fUSDCe: { address: fUSDCe },
  },
} = addressBook.fantom;

const ichiDepositHelper = web3.utils.toChecksumAddress("0xb62399d23d1c81f08eA445A42d7F15cC12090A71");
const vaultDeployer = web3.utils.toChecksumAddress("0xE495eFdf1d19668a27042D30ee22AC3C58b6fB6c");

const want = web3.utils.toChecksumAddress("0xdbae863957b545a00931c771891c40db2752ed20");
const rewardPool = web3.utils.toChecksumAddress("0x58D2C6b91AD80079bF9925E01E535d7b1eAE9090");

const vaultParams = {
  mooName: "Moo Equalizer Ichi WFTM-USDC.e", // WFTM deposit token
  mooSymbol: "mooEqualizerIchiWFTM-USDC.e",
  delay: 21600,
};

const strategyParams = {
  want: want,
  rewardPool: rewardPool,
  ichiDepositHelper: ichiDepositHelper,
  vaultDeployer: vaultDeployer,
  outputToNativeRoute: [[EQUAL, FTM, false]],
  nativeToDepositRoute: [[FTM, FTM, false]],
  unirouter: equalizer.router,
  strategist: process.env.STRATEGIST_ADDRESS,
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  feeConfig: beefyfinance.beefyFeeConfig,
  beefyVaultProxy: beefyfinance.vaultFactory,
  strategyImplementation: "0x65f1F9A882a39a2821EF8fb67B63550A00c6E5bd",
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
    strategyParams.want,
    strategyParams.rewardPool,
    strategyParams.ichiDepositHelper,
    strategyParams.vaultDeployer,
    strategyParams.outputToNativeRoute,
    strategyParams.nativeToDepositRoute,
    [
      vault,
      strategyParams.unirouter,
      strategyParams.keeper,
      strategyParams.strategist,
      strategyParams.beefyFeeRecipient,
      strategyParams.feeConfig,
    ]
  ];

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
