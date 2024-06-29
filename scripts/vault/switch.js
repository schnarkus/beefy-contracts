import hardhat, { ethers } from "hardhat";

const config = {
    strategyAddress: "0x48afC015BdcE9949B8e2CF22eEcB25bcD8D4A0a2",
    switchStrategyAbi: [
        "function switchStrategy(bool _toAura, uint256 _newPid, address _newRewardsGauge, bool _balSwapOn) external"
    ],
    newRewardsGauge: ethers.constants.AddressZero,
};

async function main() {
    await hardhat.run("compile");

    try {
        // Retrieve provider and signer from Hardhat runtime environment
        const [deployer] = await ethers.getSigners();

        // Create contract instance for switchStrategy
        const switchStrategyContract = new ethers.Contract(config.strategyAddress, config.switchStrategyAbi, deployer);

        // Prepare the parameters for switchStrategy
        const _toAura = true; // Example boolean value
        const _newPid = 29; // Example uint256 value
        const _balSwapOn = false; // Example boolean value

        // Call switchStrategy
        const switchTx = await switchStrategyContract.switchStrategy(_toAura, _newPid, config.newRewardsGauge, _balSwapOn);
        console.log("switchStrategy transaction sent. Waiting for confirmation...");

        await switchTx.wait();
        console.log("switchStrategy transaction confirmed!");

    } catch (error) {
        console.error(`Error: ${error.message}`);
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
