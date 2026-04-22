import { network } from "hardhat";

const { ethers } = await network.create();

async function main() {
  console.log("===========================================");
  console.log("  Deploy AcademicCertificate (SBT)");
  console.log("===========================================\n");

  // Ambil deployer (Account #0 dari Hardhat node)
  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "ETH\n");

  // Deploy contract
  console.log("Deploying AcademicCertificate...");
  const AcademicCertificate = await ethers.getContractFactory("AcademicCertificate");
  const contract = await AcademicCertificate.deploy();

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log("\n===========================================");
  console.log("  DEPLOY BERHASIL!");
  console.log("===========================================");
  console.log("Contract Address:", contractAddress);
  console.log("\nSalin alamat di atas dan paste ke file backend/.env");
  console.log("pada bagian CONTRACT_ADDRESS=");
  console.log("===========================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deploy gagal:", error);
    process.exit(1);
  });
