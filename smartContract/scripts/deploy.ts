import { network } from "hardhat";

const { ethers } = await network.create();

async function main() {
  console.log("===========================================");
  console.log("  Deploy AcademicCertificate (SBT)");
  console.log("===========================================\n");

  // Get deployer (Account #0 from Hardhat node)
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
  console.log("  DEPLOY SUCCESSFUL!");
  console.log("===========================================");
  console.log("Contract Address:", contractAddress);
  console.log("\nCopy the address above and paste it into backend/.env");
  console.log("in the CONTRACT_ADDRESS= field");
  console.log("===========================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deploy failed:", error);
    process.exit(1);
  });
