import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import { setPendingRewardsFunctionName } from "../../utils/setPendingRewardsFunctionName";
import vaultV7 from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7.sol/BeefyVaultV7.json";
import vaultV7Factory from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7Factory.sol/BeefyVaultV7Factory.json";
import stratAbi from "../../artifacts/contracts/BIFI/strategies/Common/StrategyCommonChefSingle.sol/StrategyCommonChefSingle.json";

const {
    platforms: { quickswap, beefyfinance },
    tokens: {
        MATIC: { address: MATIC },
        pUSDCe: { address: pUSDCe },
        GHST: { address: GHST },
    },
} = addressBook.polygon;

const GLTR = web3.utils.toChecksumAddress("0x3801c3b3b5c98f88a9c9005966aa96aa440b9afc");

const vaultParams = {
    mooName: "Moo AAVEGOTCHi WAPGHST",
    mooSymbol: "mooAAVEGOTCHiWAPGHST",
    delay: 21600,
};

const strategyParams = {
    outputToNativeRoute: [GLTR, GHST, pUSDCe, MATIC],
    outputToGHSTRoute: [GLTR, GHST],
    unirouter: quickswap.router,
    strategist: process.env.STRATEGIST_ADDRESS,
    keeper: beefyfinance.keeper,
    beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
    feeConfig: beefyfinance.beefyFeeConfig,
    beefyVaultProxy: beefyfinance.vaultFactory,
    strategyImplementation: "0x79020913dCc471B1b0274eC0354219b4c0c5f3FD",
    shouldSetPendingRewardsFunctionName: true,
    pendingRewardsFunctionName: "pending",
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
        strategyParams.outputToNativeRoute,
        strategyParams.outputToGHSTRoute,
        [
            vault,
            strategyParams.unirouter,
            strategyParams.keeper,
            strategyParams.strategist,
            strategyParams.beefyFeeRecipient,
            strategyParams.feeConfig,
        ],
    ];

    let abi = stratAbi.abi;
    const stratContract = await ethers.getContractAt(abi, strat);
    let args = strategyConstructorArguments;
    let stratInitTx = await stratContract.initialize(...args);
    stratInitTx = await stratInitTx.wait();
    stratInitTx.status === 1
        ? console.log(`Strat Intilization done with tx: ${stratInitTx.transactionHash}`)
        : console.log(`Strat Intilization failed with tx: ${stratInitTx.transactionHash}`);

    if (strategyParams.shouldSetPendingRewardsFunctionName) {
        let pendingRewardsTxHash = await setPendingRewardsFunctionName(stratContract, strategyParams.pendingRewardsFunctionName);
        console.log(`Pending rewards function name set with tx: ${pendingRewardsTxHash}`);
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
