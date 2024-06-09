import { ethers } from "hardhat";
import { addressBook } from "blockchain-addressbook";

async function main() {
    const {
        tokens: {
            pUSDCe: { address: pUSDCe },
        },
    } = addressBook.polygon;

    const want = web3.utils.toChecksumAddress("0x53c38755748745e2dd7d0a136fbcc9fb1a5b83b2");

    // Define the ABI of your SimpleSwapper contract
    const simpleSwapperABI = [
        "function setSwapInfo(address fromToken, address toToken, (address router, bytes data, uint256 amountIndex) swapInfo) external",
    ];

    // Address of your SimpleSwapper contract
    const simpleSwapperAddress = "0x2604039c6FE27b514408dB247de3a1d8BE461372";

    // Create contract instance
    const simpleSwapperContract = await ethers.getContractAt(simpleSwapperABI, simpleSwapperAddress);

    // Define your swap info data
    const swapInfoData = "0x0b4c7e4d0000000000000000000000000000000000000000000000000000000000000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0000000000000000000000000000000000000000000000000000000000000000";

    // Define fromToken and toToken addresses
    const fromToken = pUSDCe;
    const toToken = want;

    // Create SwapInfo struct
    const swapInfo = {
        router: want,
        data: swapInfoData,
        amountIndex: 36,
        // minIndex: 68,
        // minAmountSign: 0
    };

    try {
        // Send transaction to set swap info
        const tx = await simpleSwapperContract.setSwapInfo(fromToken, toToken, swapInfo);
        console.log("Transaction hash:", tx.hash);

        // Wait for the transaction to be mined
        await tx.wait();
        console.log("Swap info set successfully.");
    } catch (error) {
        console.error("Error setting swap info:", error);
    }
}

// Execute the main function
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
