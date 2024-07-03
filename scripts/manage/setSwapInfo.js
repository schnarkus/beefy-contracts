import hardhat, { ethers, web3 } from "hardhat";
import swapperAbi from "../../artifacts/contracts/BIFI/infra/BeefySwapper.sol/BeefySwapper.json";
import UniswapV3RouterAbi from "../../data/abi/UniswapV3Router.json";
import BalancerVaultAbi from "../../data/abi/BalancerVault.json";
import { addressBook } from "blockchain-addressbook";

const {
  platforms: { beefyfinance },
  tokens: {
    ARB: { address: ARB },
    BAL: { address: BAL },
    WETH: { address: WETH },
    USDC: { address: USDC },
  },
} = addressBook.arbitrum;

const ethers = hardhat.ethers;

const nullAddress = "0x0000000000000000000000000000000000000000";
const uint256Max = "115792089237316195423570985008687907853269984665640564039457584007913129639935";
const int256Max = "57896044618658097711785492504343953926634992332820282019728792003956564819967";
const beefyfinanceSwapper = "0xdc64694F820853be3b0c753f282dC3EF424137ce";

const uniswapV3Router = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
const balancerVault = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";

const config = {
  type: "uniswapV3",
  uniswapV3: {
    path: [[WETH, USDC, 500]],
    router: uniswapV3Router,
  },
  balancer: {
    path: [
      [BAL, WETH, "0xcc65a812ce382ab909a11e434dbf75b34f1cc59d000200000000000000000001"],
    ],
    router: balancerVault,
  },
};

async function main() {
  switch (config.type) {
    case 'uniswapV3':
      await uniswapV3();
      break;
    case 'balancer':
      await balancer();
      break;
  }
}

async function uniswapV3() {
  const router = await ethers.getContractAt(UniswapV3RouterAbi, config.uniswapV3.router);

  let path = ethers.utils.solidityPack(
    ["address"],
    [config.uniswapV3.path[0][0]]
  );
  for (let i = 0; i < config.uniswapV3.path.length; i++) {
    path = ethers.utils.solidityPack(
      ["bytes", "uint24", "address"],
      [path, config.uniswapV3.path[i][2], config.uniswapV3.path[i][1]]
    );
  }
  const exactInputParams = [
    path,
    beefyfinanceSwapper,
    uint256Max,
    0,
    0
  ];
  const txData = await router.populateTransaction.exactInput(exactInputParams);
  const amountIndex = 132;
  const minIndex = 164;

  const minAmountSign = 0;

  const swapInfo = [
    config.uniswapV3.router,
    txData.data,
    amountIndex,
    minIndex,
    minAmountSign
  ];

  await setSwapInfo(
    config.uniswapV3.path[0][0],
    config.uniswapV3.path[config.uniswapV3.path.length - 1][1],
    swapInfo
  );
}

async function balancer() {
  const router = await ethers.getContractAt(BalancerVaultAbi, config.balancer.router);
  const swapKind = 0;
  const swapSteps = [];
  const assets = [];
  const funds = [beefyfinanceSwapper, false, beefyfinanceSwapper, false];
  const limits = [int256Max];
  const deadline = uint256Max;

  for (let i = 0; i < config.balancer.path.length; ++i) {
    swapSteps.push([config.balancer.path[i][2], i, i + 1, 0, []])
    assets.push(config.balancer.path[i][0]);
    limits.push(0);
  }
  assets.push(config.balancer.path[config.balancer.path.length - 1][1]);

  const txData = await router.populateTransaction.batchSwap(
    swapKind,
    swapSteps,
    assets,
    funds,
    limits,
    deadline
  );
  const amountIndex = 420 + (32 * config.balancer.path.length);
  const minIndex = (txData.data.length - 66) / 2;
  const minAmountSign = -1;

  const swapInfo = [
    config.balancer.router,
    txData.data,
    amountIndex,
    minIndex,
    minAmountSign
  ];

  await setSwapInfo(
    config.balancer.path[0],
    config.balancer.path[config.balancer.path.length - 1],
    swapInfo
  );
}

async function setSwapInfo(fromToken, toToken, swapInfo) {
  const swapper = await ethers.getContractAt(swapperAbi.abi, beefyfinanceSwapper);

  let tx = await swapper.setSwapInfo(fromToken, toToken, swapInfo);
  tx = await tx.wait();
  tx.status === 1
    ? console.log(`Info set for ${toToken} with tx: ${tx.transactionHash}`)
    : console.log(`Could not set info for ${toToken}} with tx: ${tx.transactionHash}`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
