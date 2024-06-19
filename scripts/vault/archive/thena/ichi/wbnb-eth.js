import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import vaultV7 from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7.sol/BeefyVaultV7.json";
import vaultV7Factory from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7Factory.sol/BeefyVaultV7Factory.json";
import stratAbi from "../../artifacts/contracts/BIFI/strategies/Gamma/StrategyThenaIchi.sol/StrategyThenaIchi.json";

const {
  platforms: { thena, beefyfinance },
  tokens: {
    BNB: { address: BNB },
    THE: { address: THE },
  },
} = addressBook.bsc;

const ichiDepositHelper = web3.utils.toChecksumAddress("0xd9272a45BbF488816C6A5351894bCE7b04a66eE1");
const vaultDeployer = web3.utils.toChecksumAddress("0x05cC3CA6E768a68A7f86b09e3ceE754437bd5f12");

const want = web3.utils.toChecksumAddress("0x629dFc05Be606e773B1830d2616FA627C0d07f08");
const rewardPool = web3.utils.toChecksumAddress("0x80BaE01b2fA04F54E574397a9E4A97E88b31f1a4");

const vaultParams = {
  mooName: "Moo Thena Ichi WBNB-ETH", // WBNB DepositToken
  mooSymbol: "mooThenaIchiWBNB-ETH",
  delay: 21600,
};

const strategyParams = {
  want: want,
  rewardPool: rewardPool,
  depositToken: BNB,
  ichiDepositHelper: ichiDepositHelper,
  vaultDeployer: vaultDeployer,
  outputToNativePath: ethers.utils.solidityPack(["address", "address"], [THE, BNB]),
  nativeToDepositPath: "0x",
  unirouter: web3.utils.toChecksumAddress("0x327Dd3208f0bCF590A66110aCB6e5e6941A4EfA0"),
  strategist: process.env.STRATEGIST_ADDRESS,
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  feeConfig: beefyfinance.beefyFeeConfig,
  beefyVaultProxy: beefyfinance.vaultFactory,
  strategyImplementation: "0x54A8De95F6eEeEA1B1A5c7B4b8B42ef6dBC0C440",
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
    strategyParams.depositToken,
    strategyParams.ichiDepositHelper,
    strategyParams.vaultDeployer,
    strategyParams.outputToNativePath,
    strategyParams.nativeToDepositPath,
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
