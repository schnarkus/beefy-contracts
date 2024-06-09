import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import vaultV7 from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7.sol/BeefyVaultV7.json";
import vaultV7Factory from "../../artifacts/contracts/BIFI/vaults/BeefyVaultV7Factory.sol/BeefyVaultV7Factory.json";
import stratAbi from "../../artifacts/contracts/BIFI/strategies/Curve/StrategyCurveConvexL2.sol/StrategyCurveConvexL2.json";

const {
    platforms: { beefyfinance },
    tokens: {
        WMATIC: { address: WMATIC },
        pUSDCe: { address: pUSDCe },
    },
} = addressBook.polygon;

const vaultParams = {
    mooName: "Moo Curve MAI-USDC.e",
    mooSymbol: "mooCurveMAI-USDC.e",
    delay: 21600,
};

const want = web3.utils.toChecksumAddress("0x53c38755748745e2dd7d0a136fbcc9fb1a5b83b2");
const gauge = web3.utils.toChecksumAddress("0x41cb0cb61c11039459dc81db76bd64d3ede704f2");

const strategyParams = {
    native: WMATIC,
    want: want,
    gauge: gauge,
    pid: 42069,
    depositToken: pUSDCe,
    rewards: [
    ],
    unirouter: "0x2604039c6FE27b514408dB247de3a1d8BE461372",
    strategist: process.env.STRATEGIST_ADDRESS,
    keeper: beefyfinance.keeper,
    beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
    feeConfig: beefyfinance.beefyFeeConfig,
    beefyVaultProxy: beefyfinance.vaultFactory,
    strategyImplementation: "0x6c2d2958D101E31001080a8D86E55A0b2F59B662",
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
        strategyParams.native,
        strategyParams.want,
        strategyParams.gauge,
        strategyParams.pid,
        strategyParams.depositToken,
        strategyParams.rewards,
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
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
