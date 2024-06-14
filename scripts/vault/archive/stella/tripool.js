import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import vaultV7 from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7.sol/BeefyVaultV7.json";
import vaultV7Factory from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7Factory.sol/BeefyVaultV7Factory.json";
import stratAbi from "../../artifacts/contracts/BIFI/strategies/Stellaswap/StrategyStellaswapStable.sol/StrategyStellaswapStable.json";

const {
    platforms: { stellaswap, beefyfinance },
    tokens: {
        STELLA: { address: STELLA },
        WGLMR: { address: WGLMR },
        USDCwh: { address: USDCwh },
    },
} = addressBook.moonbeam;

const want = web3.utils.toChecksumAddress("0x4FB1b0452341ebB0DF325a8286763447dd6F15fF");
const pool = web3.utils.toChecksumAddress("0x5c3dc0ab1bd70c5cdc8d0865e023164d4d3fd8ec");

const vaultParams = {
    mooName: "Moo StellaSwap Tripool",
    mooSymbol: "mooStellaSwapTripool",
    delay: 21600,
};

const strategyParams = {
    want: want,
    input: USDCwh,
    chef: stellaswap.masterchefV1distributorV2,
    pid: 37,
    stableRouter: pool,
    uniswapType: false,
    outputToNativePath: ethers.utils.solidityPack(["address", "address"], [STELLA, WGLMR]),
    nativeToInputPath: ethers.utils.solidityPack(["address", "address"], [WGLMR, USDCwh]),
    unirouter: web3.utils.toChecksumAddress("0xe6d0ED3759709b743707DcfeCAe39BC180C981fe"),
    strategist: process.env.STRATEGIST_ADDRESS,
    keeper: beefyfinance.keeper,
    beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
    feeConfig: beefyfinance.beefyFeeConfig,
    beefyVaultProxy: beefyfinance.vaultFactory,
    strategyImplementation: "0x3c18228B04d4AD84Af15781EDC4C2E346132830f",
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

    let implementation = strategyParams.Strat ? strategyParams.strategyImplementation : strategyParams.strategyImplementation;
    let strat = await factory.callStatic.cloneContract(implementation);
    let stratTx = await factory.cloneContract(implementation);
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
        ? console.log(`Vault OwnershipTransfered done with tx: ${vaultInitTx.transactionHash}`)
        : console.log(`Vault Intilization failed with tx: ${vaultInitTx.transactionHash}`);

    const strategyConstructorArguments = [
        strategyParams.want,
        strategyParams.input,
        strategyParams.chef,
        strategyParams.pid,
        strategyParams.stableRouter,
        strategyParams.uniswapType,
        strategyParams.outputToNativePath,
        strategyParams.nativeToInputPath,
        [
            vault,
            strategyParams.unirouter,
            strategyParams.keeper,
            strategyParams.strategist,
            strategyParams.beefyFeeRecipient,
            strategyParams.feeConfig,
        ]
    ];

    const stratContract = await ethers.getContractAt(stratAbi.abi, strat);
    let args = strategyParams.Strat ? strategyConstructorArguments : strategyConstructorArguments
    let stratInitTx = await stratContract.initialize(...args);
    stratInitTx = await stratInitTx.wait()
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