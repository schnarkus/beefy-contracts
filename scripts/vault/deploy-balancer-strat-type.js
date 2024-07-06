import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import vaultV7 from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7.sol/BeefyVaultV7.json";
import vaultV7Factory from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7Factory.sol/BeefyVaultV7Factory.json";
import stratAbi from "../../artifacts/contracts/BIFI/strategies/Balancer/StrategyAuraBalancerGyro.sol/StrategyAuraBalancerGyro.json";

const {
  platforms: { balancer, beefyfinance },
  tokens: {
    BAL: { address: BAL },
    WETH: { address: WETH },
    ARB: { address: ARB },
  },
} = addressBook.arbitrum;

const AaveUSDCn = web3.utils.toChecksumAddress("0x7CFaDFD5645B50bE87d546f42699d863648251ad");
const GHO = web3.utils.toChecksumAddress("0x7dfF72693f6A4149b17e7C6314655f6A9F7c8B33");

const want = web3.utils.toChecksumAddress("0x46472CBA35E6800012aA9fcC7939Ff07478C473E");

const vaultParams = {
  mooName: "Moo Balancer Arb AaveUSDCn-GHO",
  mooSymbol: "mooBalancerArbAaveUSDCn-GHO",
  delay: 21600,
};

const bytes0 = "0x0000000000000000000000000000000000000000000000000000000000000000";

const strategyParams = {
  want: want,
  isAura: false,
  pid: 42069,
  rewardsGauge: "0x6e654787251ae77Fe1873f93A5f220E00afa90E8",
  balSwapOn: false,
  useAave: true,
  aaveIndex: 0,
  native: WETH,
  output: BAL,
  lp0ToLp1Assets: [AaveUSDCn, GHO],
  lp0ToLp1Route: [["0x46472cba35e6800012aa9fcc7939ff07478c473e00020000000000000000056c", 0, 1]],
  unirouter: beefyfinance.beefySwapper,
  strategist: process.env.STRATEGIST_ADDRESS,
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  beefyFeeConfig: beefyfinance.beefyFeeConfig,
  beefyVaultProxy: beefyfinance.vaultFactory,
  strategyImplementation: "0xE054BC61d2Ef0935c02D8a31d1ee5780bB8eaeD9",
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
    strategyParams.useAave,
    strategyParams.aaveIndex,
    strategyParams.native,
    strategyParams.output,
    strategyParams.lp0ToLp1Assets,
    strategyParams.lp0ToLp1Route,
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

  stratInitTx = await stratContract.addReward(ARB);
  stratInitTx = await stratInitTx.wait();
  stratInitTx.status === 1
    ? console.log(`ARB Reward Added with tx: ${stratInitTx.transactionHash}`)
    : console.log(`ARB Reward Addition failed with tx: ${stratInitTx.transactionHash}`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
