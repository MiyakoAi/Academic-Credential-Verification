import { network } from "hardhat";
import "dotenv/config";

const { ethers } = await network.create();

async function main() {
  const [owner] = await ethers.getSigners();
  const contractAddress = process.env.CONTRACT_ADDRESS!;
  const factory = await ethers.getContractFactory("AcademicCertificate");
  const contract = factory.attach(contractAddress);
  
  const isAuthorizedBefore = await contract.authorizedIssuers(owner.address);
  console.log("Is authorized before?", isAuthorizedBefore);

  if (!isAuthorizedBefore) {
    console.log("Authorizing...", owner.address);
    const tx = await contract.addIssuer(owner.address, "Super Admin Kampus");
    await tx.wait();
    console.log("Success! You are now an authorized issuer.");
  } else {
    console.log("You are already authorized!");
  }
}

main().catch(console.error);
