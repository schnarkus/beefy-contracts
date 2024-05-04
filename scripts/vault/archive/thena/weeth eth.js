import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import vaultV7 from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7.sol/BeefyVaultV7.json";
import vaultV7Factory from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7Factory.sol/BeefyVaultV7Factory.json";
import stratHoldLPAbi from "../../artifacts/contracts/BIFI/strategies/Gamma/StrategyThenaGamma.sol/StrategyThenaGamma.json";

const {
  platforms: { beefyfinance },
  tokens: {
    BNB: { address: BNB },
    THE: { address: THE },
    ETH: { address: ETH },
  },
} = addressBook.bsc;

const weETH = web3.utils.toChecksumAddress("0x04C0599Ae5A44757c0af6F9eC3b93da8976c150A");

const want = web3.utils.toChecksumAddress("0xc2c05763Ea35c4db63C49631206F07215d6d0D39");
const rewardPool = web3.utils.toChecksumAddress("0x98C6F030F1B58edD1037b32348307E4667559a40");

const vaultParams = {
  mooName: "Moo Thena Gamma weETH-ETH Narrow",
  mooSymbol: "mooThenaGammaweETH-ETHNarrow",
  delay: 21600,
};

const strategyParams = {
  want: want,
  rewardPool: rewardPool,
  outputToNativePath: ethers.utils.solidityPack(["address", "address"], [THE, BNB]),
  nativeToLp0Path: ethers.utils.solidityPack(["address", "address", "address"], [BNB, ETH, weETH]),
  nativeToLp1Path: ethers.utils.solidityPack(["address", "address"], [BNB, ETH]),
  unirouter: web3.utils.toChecksumAddress("0x327Dd3208f0bCF590A66110aCB6e5e6941A4EfA0"),
  strategist: process.env.STRATEGIST_ADDRESS, // some address
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  feeConfig: beefyfinance.beefyFeeConfig,
  beefyVaultProxy: beefyfinance.vaultFactory,
  strategyImplementation: "0x",
  strategyHoldLPImplementation: "0x71FabA0a60878421610F68FE6Fd1b7e76039F0eb",
  holdLPStrat: true,
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

  let implementation = strategyParams.holdLPStrat ? strategyParams.strategyHoldLPImplementation : strategyParams.strategyImplementation;
  let strat = await factory.callStatic.cloneContract(implementation);
  let stratTx = await factory.cloneContract(implementation);
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
    strategyParams.want,
    strategyParams.rewardPool,
    strategyParams.outputToNativePath,
    strategyParams.nativeToLp0Path,
    strategyParams.nativeToLp1Path,
    [
      vault,
      strategyParams.unirouter,
      strategyParams.keeper,
      strategyParams.strategist,
      strategyParams.beefyFeeRecipient,
      strategyParams.feeConfig,
    ]
  ];

  const strategyHoldLPConstructorArguments = [
    strategyParams.want,
    strategyParams.rewardPool,
    strategyParams.outputToNativePath,
    strategyParams.nativeToLp0Path,
    strategyParams.nativeToLp1Path,
    [
      vault,
      strategyParams.unirouter,
      strategyParams.keeper,
      strategyParams.strategist,
      strategyParams.beefyFeeRecipient,
      strategyParams.feeConfig,
    ]
  ];

  let abi = strategyParams.holdLPStrat ? stratHoldLPAbi.abi : stratAbi.abi;
  const stratContract = await ethers.getContractAt(abi, strat);
  let args = strategyParams.holdLPStrat ? strategyHoldLPConstructorArguments : strategyConstructorArguments
  let stratInitTx = await stratContract.initialize(...args);
  stratInitTx = await stratInitTx.wait()
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