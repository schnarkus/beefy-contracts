import { ethers } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import stratAbi from "../../artifacts/contracts/BIFI/strategies/Balancer/StrategyAuraSideChain.sol/StrategyAuraSideChain.json";

const {
    tokens: {
        ETH: { address: ETH },
    },
} = addressBook.base;

const BAL = web3.utils.toChecksumAddress("0x4158734D47Fc9692176B5085E0F52ee0Da5d47F1");
const AURA = web3.utils.toChecksumAddress("0x1509706a6c66CA549ff0cB464de88231DDBe213B");

const want = web3.utils.toChecksumAddress("0xaB99a3e856dEb448eD99713dfce62F937E2d4D74");

async function main() {
    try {
        // Contract address where setRoutes function exists
        const contractAddress = "0x2B4E2c73D82F1c489C15ac113D888B126D1a12F6"; // Replace with actual contract address
        const contract = await ethers.getContractAt(stratAbi.abi, contractAddress); // Get contract instance

        // Define routes and assets
        const _nativeToInputRoute = [
            { poolId: "0xab99a3e856deb448ed99713dfce62f937e2d4d74000000000000000000000118", assetInIndex: 0, assetOutIndex: 1 },
        ];
        const _outputToNativeRoute = [
            { poolId: "0xa04259de0129ac4c4a0ce22be2ec729482034ba000020000000000000000016d", assetInIndex: 0, assetOutIndex: 1 },
            { poolId: "0xcb470da0902e6c548f0e8161042f624599286e9b000200000000000000000105", assetInIndex: 1, assetOutIndex: 2 }
        ];
        const _nativeToInputAssets = [ETH, want];
        const _outputToNativeAssets = [BAL, AURA, ETH];

        // Call setRoutes function
        const tx = await contract.setRoutes(_nativeToInputRoute, _outputToNativeRoute, _nativeToInputAssets, _outputToNativeAssets);
        const receipt = await tx.wait();
        console.log("Transaction mined:", receipt.transactionHash);

        // Check if the transaction was successful
        if (receipt.status === 1) {
            console.log("SetRoutes function executed successfully!");
        } else {
            console.log("Failed to execute SetRoutes function.");
        }

    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
}

// Execute main function
main().then(() => process.exit(0));
