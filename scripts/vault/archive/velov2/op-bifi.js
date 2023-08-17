import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import vaultV7 from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7.sol/BeefyVaultV7.json";
import vaultV7Factory from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7Factory.sol/BeefyVaultV7Factory.json";
import stratAbi from "../../artifacts/contracts/BIFI/strategies/Common/StrategyCommonVelodromeGaugeV2.sol/StrategyCommonVelodromeGaugeV2.json";

const {
  platforms: { beefyfinance },
  tokens: {
    ETH: { address: ETH },
    USDC: { address: USDC },
    BIFI: { address: BIFI },
    OP: { address: OP },
  },
} = addressBook.optimism;

const VELOV2 = web3.utils.toChecksumAddress("0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db");
const router = web3.utils.toChecksumAddress("0xa062aE8A9c5e11aaA026fc2670B0D65cCc8B2858");
const zero = ethers.constants.AddressZero;

const want = web3.utils.toChecksumAddress("0xe0A1467A9d86d9F433496c48c6831c0142464CE6");
const gauge = web3.utils.toChecksumAddress("0x54A80dd7d56388A69dab04f92df5098f71F01fEA");

const vaultParams = {
  mooName: "Moo VeloV2 OP-BIFI",
  mooSymbol: "mooVeloV2OP-BIFI",
  delay: 21600,
};

const strategyParams = {
  want: want,
  gauge: gauge,
  unirouter: router,
  strategist: process.env.STRATEGIST_ADDRESS, //some address
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  feeConfig: beefyfinance.beefyFeeConfig,
  outputToNativeRoute: [
    [VELOV2, USDC, false, zero],
    [USDC, ETH, false, zero],
  ],
  outputToLp0Route: [
    [VELOV2, USDC, false, zero],
    [USDC, OP, false, zero],
  ],
  outputToLp1Route: [
    [VELOV2, USDC, false, zero],
    [USDC, OP, false, zero],
    [OP, BIFI, false, zero],
  ],
  beefyVaultProxy: beefyfinance.vaultFactory,
  strategyImplementation: "0x83fF748c4DAD196944dED62c998DDc87A57a4198",
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
    strategyParams.gauge,
    [
      vault,
      strategyParams.unirouter,
      strategyParams.keeper,
      strategyParams.strategist,
      strategyParams.beefyFeeRecipient,
      strategyParams.feeConfig,
    ],
    strategyParams.outputToNativeRoute,
    strategyParams.outputToLp0Route,
    strategyParams.outputToLp1Route,
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
