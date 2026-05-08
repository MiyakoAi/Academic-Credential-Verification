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

  const deployStartTime = Date.now();
  const certificate = await AcademicCertificate.deploy();

  await certificate.waitForDeployment();
  const contractAddress = await certificate.getAddress();
  const deployTime = ((Date.now() - deployStartTime) / 1000).toFixed(3);

  // Automatically register owner as the first issuer
  console.log("Authorizing deployer as the first issuer...");

  const issuerStartTime = Date.now();
  const tx = await certificate.addIssuer(deployer.address, "Super Admin Kampus");
  await tx.wait();
  const issuerTime = ((Date.now() - issuerStartTime) / 1000).toFixed(3);

  console.log("\n===========================================");
  console.log("  DEPLOY SUCCESSFUL!");
  console.log("===========================================");
  console.log("Contract Address:", contractAddress);
  console.log("Deploy Time          :", deployTime, "seconds (s)");
  console.log("Issuer Register Time :", issuerTime, "seconds (s)");
  console.log("Total Time           :", ((Date.now() - deployStartTime) / 1000).toFixed(3), "seconds (s)");
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
