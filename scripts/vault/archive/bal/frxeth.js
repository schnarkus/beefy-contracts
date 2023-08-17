import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import vaultV7 from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7.sol/BeefyVaultV7.json";
import vaultV7Factory from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7Factory.sol/BeefyVaultV7Factory.json";
import stratAbi from "../../artifacts/contracts/BIFI/strategies/Balancer/StrategyBalancerMultiRewardGaugeUniV3.sol/StrategyBalancerMultiRewardGaugeUniV3.json";
import stratComAbi from "../../artifacts/contracts/BIFI/strategies/Balancer/StrategyBalancerComposableMultiRewardGaugeUniV3.sol/StrategyBalancerComposableMultiRewardGaugeUniV3.json";

const {
  platforms: { balancer, beefyfinance },
  tokens: {
    BAL: { address: BAL },
    MATIC: { address: MATIC },
    ETH: { address: ETH }
  },
} = addressBook.polygon;

const gauge = web3.utils.toChecksumAddress("0xF75Bf196b64f2FCf942C29b5bE7f4742e4fD16Bd");
const want = web3.utils.toChecksumAddress("0x5DEe84FfA2DC27419Ba7b3419d7146E53e4F7dEd");

const vaultParams = {
  mooName: "Moo Balancer ETH-frxETH",
  mooSymbol: "mooBalancerETH-frxETH",
  delay: 21600,
};

const strategyParams = {
  input: ETH,
  isComposable: false,
  unirouter: balancer.router,
  strategist: process.env.STRATEGIST_ADDRESS,
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  beefyFeeConfig: beefyfinance.beefyFeeConfig,
  isBeets: false,
  beefyVaultProxy: beefyfinance.vaultFactory,
  composableStrat: false,
  strategyImplementation: "0xCeb2438FDCCa605308F8108622C89592Fd46c1d8",
  comStrategyImplementation: "",
  useVaultProxy: true,
  extraReward: false,
  secondExtraReward: false,
  outputToNativeAssets: [
    BAL,
    MATIC
  ],
  outputToNativeRouteBytes: [
    [
      "0x0297e37f1873d2dab4487aa67cd56b58e2f27875000100000000000000000002",
      0,
      1
    ],
  ],
  nativeToWantAssets: [
    MATIC,
    ETH,
  ],
  nativeToWantRouteBytes: [
    [
      "0x0297e37f1873d2dab4487aa67cd56b58e2f27875000100000000000000000002",
      0,
      1
    ]
  ],
  rewardAssets: [
  ],
  rewardRoute: [
    [
      "0x88d07558470484c03d3bb44c3ecc36cafcf43253000000000000000000000051",
      0,
      1
    ],
    [
      "0x899f737750db562b88c1e412ee1902980d3a4844000200000000000000000081",
      1,
      2
    ],
    [
      "0xde45f101250f2ca1c0f8adfc172576d10c12072d00000000000000000000003f",
      2,
      3
    ],
    [
      "0xdd89c7cd0613c1557b2daac6ae663282900204f100000000000000000000003e",
      3,
      4
    ]
  ],
  secondRewardAssets: [
  ],
  secondRewardRoute: [
    [
      "0x39965c9dab5448482cf7e002f583c812ceb53046000100000000000000000003",
      0,
      1
    ],
  ]
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
  let stratTx = await factory.cloneContract(strategyParams.composableStrat ? strategyParams.comStrategyImplementation : strategyParams.strategyImplementation);
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
    ? console.log(`Vault OwnershipTransferred done with tx: ${vaultInitTx.transactionHash}`)
    : console.log(`Vault Intilization failed with tx: ${vaultInitTx.transactionHash}`);

  const strategyConstructorArguments = [
    want,
    [
      strategyParams.isComposable,
      strategyParams.isBeets
    ],
    strategyParams.nativeToWantRouteBytes,
    strategyParams.outputToNativeRouteBytes,
    [
      strategyParams.outputToNativeAssets,
      strategyParams.nativeToWantAssets
    ],
    gauge,
    [vault,
      strategyParams.unirouter,
      strategyParams.keeper,
      strategyParams.strategist,
      strategyParams.beefyFeeRecipient,
      strategyParams.beefyFeeConfig],
  ];

  const comStrategyConstructorArguments = [
    strategyParams.nativeToWantRouteBytes,
    strategyParams.outputToNativeRouteBytes,
    [
      strategyParams.outputToNativeAssets,
      strategyParams.nativeToWantAssets
    ],
    gauge,
    strategyParams.isBeets,
    [vault,
      strategyParams.unirouter,
      strategyParams.keeper,
      strategyParams.strategist,
      strategyParams.beefyFeeRecipient,
      strategyParams.beefyFeeConfig],
  ];

  let abi = strategyParams.composableStrat ? stratComAbi.abi : stratAbi.abi;
  const stratContract = await ethers.getContractAt(abi, strat);
  let args = strategyParams.composableStrat ? comStrategyConstructorArguments : strategyConstructorArguments
  let stratInitTx = await stratContract.initialize(...args);
  stratInitTx = await stratInitTx.wait()
  stratInitTx.status === 1
    ? console.log(`Strat Intilization done with tx: ${stratInitTx.transactionHash}`)
    : console.log(`Strat Intilization failed with tx: ${stratInitTx.transactionHash}`);


  if (strategyParams.extraReward) {
    stratInitTx = await stratContract.addRewardToken(strategyParams.rewardAssets[0], strategyParams.rewardRoute, strategyParams.rewardAssets, bytes0, 100);
    stratInitTx = await stratInitTx.wait()
    stratInitTx.status === 1
      ? console.log(`Reward Added with tx: ${stratInitTx.transactionHash}`)
      : console.log(`Reward Addition failed with tx: ${stratInitTx.transactionHash}`);
  }

  if (strategyParams.secondExtraReward) {
    stratInitTx = await stratContract.addRewardToken(strategyParams.secondRewardAssets[0], strategyParams.secondRewardRoute, strategyParams.secondRewardAssets, bytes0, 100);
    stratInitTx = await stratInitTx.wait()
    stratInitTx.status === 1
      ? console.log(`Reward Added with tx: ${stratInitTx.transactionHash}`)
      : console.log(`Reward Addition failed with tx: ${stratInitTx.transactionHash}`);
  }
  // add this info to PR
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });