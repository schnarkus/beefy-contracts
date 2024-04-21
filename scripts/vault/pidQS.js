const { ethers } = require('hardhat');

const chefAbi = [
  {
    "inputs": [
      {
        "internalType": "contract IERC20",
        "name": "_sushi",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "poolLength",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "pools",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_pid",
        "type": "uint256"
      }
    ],
    "name": "lpToken",
    "outputs": [
      {
        "internalType": "contract IERC20",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

async function main() {
  const chefAddress = '0x20ec0d06f447d550fc6edee42121bc8c1817b97d'; // MasterChef contract address

  const chefContract = await ethers.getContractAt(chefAbi, chefAddress); // Get contract instance

  // Get the number of pools
  const poolLength = await chefContract.poolLength();

  console.log(`Total number of pools: ${poolLength}`);

  // Iterate over pools in reverse order
  for (let pid = poolLength - 1; pid >= 0; pid--) {
    try {
      const lpTokenAddress = await chefContract.lpToken(pid);
      console.log(`Pool ${pid}: LP Token Address = ${lpTokenAddress}`);
      // You can perform more actions with this LP token address if needed
    } catch (error) {
      console.error(`Error fetching LP token for pool ${pid}:`, error);
    }
  }
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
