import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import vaultV7 from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7.sol/BeefyVaultV7.json";
import vaultV7Factory from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7Factory.sol/BeefyVaultV7Factory.json";
import stratAbi from "../../artifacts/contracts/BIFI/strategies/Common/StrategyCommonChefLPProxy.sol/StrategyCommonChefLPProxy.json";

const {
    platforms: { beefyfinance },
    tokens: {
        WIGO: { address: WIGO },
        FTM: { address: FTM },
        sFTMx: { address: sFTMx }
    },
} = addressBook.fantom;

const want = web3.utils.toChecksumAddress("0x43E1059c05D3153B5D74303DD6474a43BC87E73e");

const vaultParams = {
    mooName: "Moo WigoSwap FTM-sFTMx",
    mooSymbol: "mooWigoSwapFTM-sFTMx",
    delay: 21600,
};

const strategyParams = {
    want: want,
    poolId: 23,
    chef: "0xA1a938855735C0651A6CfE2E93a32A28A236d0E9",
    unirouter: "0x5023882f4D1EC10544FCB2066abE9C1645E95AA0",
    strategist: process.env.STRATEGIST_ADDRESS,
    keeper: beefyfinance.keeper,
    beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
    beefyFeeConfig: beefyfinance.beefyFeeConfig,
    outputToNativeRoute: [WIGO, FTM],
    outputToLp0Route: [WIGO, FTM],
    outputToLp1Route: [WIGO, FTM, sFTMx],
    beefyVaultProxy: "0x740CE0674aF6eEC113A435fAa53B297536A3e89B",
    strategyImplementation: "0x0f6846faad2add2803A9D522d9a38647a07F9cBB",
    strategyMainnetImplementation: "",
    useVaultProxy: true,
    isMainnetVault: false,
    shouldSetPendingRewardsFunctionName: true,
    pendingRewardsFunctionName: "pendingWigo", // used for rewardsAvailable(), use correct function name from masterchef
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

    let strat = await factory.callStatic.cloneContract(strategyParams.isMainnetVault ? strategyParams.strategyMainnetImplementation : strategyParams.strategyImplementation);
    let stratTx = await factory.cloneContract(strategyParams.isMainnetVault ? strategyParams.strategyMainnetImplementation : strategyParams.strategyImplementation);
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
        strategyParams.want,
        strategyParams.poolId,
        strategyParams.chef,
        [
            vault,
            strategyParams.unirouter,
            strategyParams.keeper,
            strategyParams.strategist,
            strategyParams.beefyFeeRecipient,
            strategyParams.beefyFeeConfig
        ],
        strategyParams.outputToNativeRoute,
        strategyParams.outputToLp0Route,
        strategyParams.outputToLp1Route
    ];

    let abi = strategyParams.isMainnetVault ? stratAbiEth.abi : stratAbi.abi;
    const stratContract = await ethers.getContractAt(abi, strat);
    let args = strategyConstructorArguments
    let stratInitTx = await stratContract.initialize(...args);
    stratInitTx = await stratInitTx.wait()
    stratInitTx.status === 1
        ? console.log(`Strat Intilization done with tx: ${stratInitTx.transactionHash}`)
        : console.log(`Strat Intilization failed with tx: ${stratInitTx.transactionHash}`);

    stratInitTx = await stratContract.setPendingRewardsFunctionName(strategyParams.pendingRewardsFunctionName);
    stratInitTx = await stratInitTx.wait()
    stratInitTx.status === 1
        ? console.log(`Pending Reward Name Set with tx: ${stratInitTx.transactionHash}`)
        : console.log(`Pending Reward Name Set with tx: ${stratInitTx.transactionHash}`);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });