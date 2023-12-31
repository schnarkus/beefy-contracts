import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import Abi from "../../artifacts/contracts/BIFI/strategies/Balancer/AuraSrcSwapper.sol/AuraSrcSwapper.json";

const {
  platforms: { beefyfinance },
  tokens: {
    ETH: { address: ETH },
  },
} = addressBook.base;

const aura = web3.utils.toChecksumAddress("0x1509706a6c66CA549ff0cB464de88231DDBe213B");
const stargate = web3.utils.toChecksumAddress("0x45f1A95A4D3f3836523F5c83673c797f4d4d263B");
const endpoint = web3.utils.toChecksumAddress("0xb6319cC6c8c27A8F5dAF0dD3DF91EA35C4720dd7");

const config = {
  aura: aura,
  native: ETH,
  stargate: stargate,
  endpoint: endpoint,
  auraSwapper: "0x79a124080c2d08eddDE62181A5256ECc6580aEC7",
  dstChainId: 110,
};

const constructorArguments = [
  config.aura,
  config.native,
  config.stargate,
  config.endpoint,
  config.auraSwapper,
  config.dstChainId,
];

async function main() {
  await hardhat.run("compile");

  const Swapper = await ethers.getContractFactory("AuraSrcSwapper");
  const swapper = await Swapper.deploy(...constructorArguments);
  await swapper.deployed();

  console.log("Swapper deployed to:", swapper.address);

  const Contract = await ethers.getContractAt(Abi.abi, swapper.address);

  console.log(`Setting Trusted Remote....`);
  await swapper.setTrustedRemoteAddress(110, "0x79a124080c2d08eddDE62181A5256ECc6580aEC7");

  console.log(`Setting Bridge Config....`);
  await swapper.setBridgeConfig(2000000, config.auraSwapper, config.stargate);

  console.log(`Transferring Ownership....`);
  await swapper.transferOwnership(beefyfinance.devMultisig);

  console.log(`Verifying contract....`);
  await hardhat.run("verify:verify", {
    address: swapper.address,
    constructorArguments,
  });
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
