import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import vaultV7 from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7.sol/BeefyVaultV7.json";
import vaultV7Factory from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7Factory.sol/BeefyVaultV7Factory.json";
import stratHoldLPAbi from "../../artifacts/contracts/BIFI/strategies/Gamma/StrategyQuickGamma.sol/StrategyQuickGamma.json";

const {
  platforms: { beefyfinance },
  tokens: {
    MATIC: { address: MATIC },
    newQUICK: { address: newQUICK },
    ETH: { address: ETH },
  },
} = addressBook.polygon;

const want = web3.utils.toChecksumAddress("0x81Cec323BF8C4164c66ec066F53cc053A535f03D");

const vaultParams = {
  mooName: "Moo Quick Dummy WMATIC-WETH",
  mooSymbol: "mooQuickDummyWMATIC-WETH",
  delay: 21600,
};

const strategyParams = {
  want: want,
  outputToNativePath: ethers.utils.solidityPack(["address", "address"], [newQUICK, MATIC]),
  nativeToLp0Path: "0x",
  nativeToLp1Path: ethers.utils.solidityPack(["address", "address"], [MATIC, ETH]),
  unirouter: web3.utils.toChecksumAddress("0xf5b509bB0909a69B1c207E495f687a596C168E12"),
  strategist: process.env.STRATEGIST_ADDRESS, // some address
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  feeConfig: beefyfinance.beefyFeeConfig,
  beefyVaultProxy: beefyfinance.vaultFactory,
  strategyImplementation: "0x",
  strategyHoldLPImplementation: "0xa43AfC157B8c54F4F9F98d829C9553747C948E48",
  holdLPStrat: true,
  addReward: false,
  // rewardToken: SD,
  // rewardPath: ethers.utils.solidityPack(["address", "address", "address"], [SD, USDC, MATIC])
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

  if (strategyParams.addReward) {
    stratInitTx = await stratContract.addReward(strategyParams.rewardToken, strategyParams.rewardPath);
    stratInitTx = await stratInitTx.wait()
    stratInitTx.status === 1
      ? console.log(`Adding Rewards done with tx: ${stratInitTx.transactionHash}`)
      : console.log(`Adding Reward failed with tx: ${stratInitTx.transactionHash}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });