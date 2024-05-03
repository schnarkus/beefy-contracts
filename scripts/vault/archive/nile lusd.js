import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import vaultV7 from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7.sol/BeefyVaultV7.json";
import vaultV7Factory from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7Factory.sol/BeefyVaultV7Factory.json";
import stratAbi from "../../artifacts/contracts/BIFI/strategies/Common/StrategyCommonSolidlyGaugeMultiRewardLP.sol/StrategyCommonSolidlyGaugeMultiRewardLP.json";

const {
  platforms: { beefyfinance },
  tokens: {
    ETH: { address: ETH },
    USDC: { address: USDC },
  },
} = addressBook.linea;

const NILE = web3.utils.toChecksumAddress("0xAAAac83751090C6ea42379626435f805DDF54DC8");
const LUSD = web3.utils.toChecksumAddress("0x63bA74893621d3d12F13CEc1e86517eC3d329837");
const router = web3.utils.toChecksumAddress("0xAAA45c8F5ef92a000a121d102F4e89278a711Faa");

const want = web3.utils.toChecksumAddress("0x641d5eAa27e516E1CF1F5C84B5EC25C45b7e3f0D");
const gauge = web3.utils.toChecksumAddress("0xA939c7bf57FccaC34d60938412aF6CA2CA246ca0");

const vaultParams = {
  mooName: "Moo Nile USDC-LUSD",
  mooSymbol: "mooNileUSDC-LUSD",
  delay: 21600,
};

const strategyParams = {
  want: want,
  gauge: gauge,
  useNative: false,
  routeToUSDC: ethers.utils.solidityPack(["address", "uint24", "address"], [ETH, 250, USDC]),
  unirouter: router,
  strategist: process.env.STRATEGIST_ADDRESS,
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  feeConfig: beefyfinance.beefyFeeConfig,
  outputToNativeRoute: [
    [NILE, ETH, false],
  ],
  nativeToLp0Route: [
    [USDC, USDC, false],
  ],
  nativeToLp1Route: [
    [USDC, LUSD, true],
  ],
  beefyVaultProxy: beefyfinance.vaultFactory,
  strategyImplementation: "0xC41aC910e6773C6E06D41D3b4246aDf979590FE0",
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
    strategyParams.useNative,
    strategyParams.routeToUSDC,
    [
      vault,
      strategyParams.unirouter,
      strategyParams.keeper,
      strategyParams.strategist,
      strategyParams.beefyFeeRecipient,
      strategyParams.feeConfig,
    ],
    strategyParams.outputToNativeRoute,
    strategyParams.nativeToLp0Route,
    strategyParams.nativeToLp1Route,
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
