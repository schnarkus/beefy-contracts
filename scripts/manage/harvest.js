const hardhat = require("hardhat");
const ethers = hardhat.ethers;

const harvestAbi = ["function harvest() public"];
console.log("Harvesting...");

const contracts = [
  "0x23DA8Ac1E5d406f8D2476BC9ac0D8CdCA9c566Cd",
  "0xb948e2d44ec033987Db4cbcC500F13176CAeC29E",
  "0x9f617d1b407af7a93feBbf195956ac3ECC2d173c",
  "0xF73AebA225791a256B0c9A3B2929Be6547D5e1D6",
  "0x9DcFF4CE72E9635F40b14Da8E428873308F2D16D",
  "0x876d7610Ce675E8DC6A772973d5fb30e0f11951e",
  "0xa8295AF35CD45b5F48ca950d137AB252c9d945ff",
  "0xA25Cd5d445c462D0B1F1B965099837b816dfD1a9",
  "0x8906BE753c196068c723Fad59998560239b8B7D9",
  "0xB835Bd975b7941a10d0aeFcecb748d12f1EE780f",
  "0xaC3778DC45B5e415DaA78CCC31f25169bD98C43A",
  "0x044C4F4cCCf643b48Cd720449B7da3D9F4011636",
  "0x5c02bA9dA102bC784789d8219f62850dfBC665Ae",
  "0xe18EC0a1E823a64a575f06636578Fba7b4787688",
  "0x96213dFb2CbD6a3EEfa8EEEe146564A8eC34b76a",
  "0xf98878012d998934bEe9298cB7fC144F2447c7DA",
  "0xF38b089De9757f9C8a37400f96A8344223B7ba47",
  "0x8875edb3e87ad4f75f8829976dD46E22225C45D1",
  "0x0d2573D2729f09766Ff7fd8D4bdDb5d0784293d5",
  "0x61a52cC6EDcC699B9877da0e03A34C45eb5eD3f8",
];

async function main() {
  for (const address of contracts) {
    try {
      const contract = await ethers.getContractAt(harvestAbi, address);
      const tx = await contract.harvest();
      await tx.wait();
      console.log(address, "done");
    } catch (error) {
      console.log(error.name);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
