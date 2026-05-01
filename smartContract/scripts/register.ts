import { network } from "hardhat";

const { ethers } = await network.create();

async function main() {
  // ===================================================
  // TESTING FILE REGISTER DI SMART CONTRACT [ISI DATA]
  // ===================================================
  const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

  const DOCUMENT_ID = "UMI-2022-13020220111";
  const IPFS_CID = "bafybeiavvdzxik3j5exv7jfwq7bmxelfopygkueqy5adnkjgl4oo2mm7p4";
  const STUDENT_NAME = "Miyako";
  const STUDENT_ID = "13020220111";
  const STUDENT_WALLET = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const DEGREE = "S1";
  const MAJOR = "Sarjana Teknik";
  const METADATA_URI = "ipfs://bafkreidbyftxuoedec4vsb5kjjjpafd24b4nzkuggbrd5bontzel6wzjj4";
  // ===================================================

  console.log("===========================================");
  console.log("  Register Certificate to Blockchain");
  console.log("===========================================\n");

  // Get signer (Account #0 = owner = deployer)
  const [owner] = await ethers.getSigners();
  console.log("Transaction sender (Owner):", owner.address);

  // Connect to the deployed smart contract
  const contract = await ethers.getContractAt("AcademicCertificate", CONTRACT_ADDRESS);

  // Step 1: Add owner as issuer (so they can register)
  console.log("\nStep 1: Adding owner as issuer...");
  try {
    const txAddIssuer = await contract.addIssuer(owner.address, "Universitas Muslim Indonesia");
    await txAddIssuer.wait();
    console.log("   Issuer added successfully!");
  } catch (e: any) {
    if (e.message.includes("Issuer is already registered")) {
      console.log("   Issuer already registered, continuing...");
    } else {
      throw e;
    }
  }

  // Step 2: Register certificate (mint SBT to student wallet)
  console.log("\nStep 2: Registering certificate to blockchain...");
  console.log("   Document ID :", DOCUMENT_ID);
  console.log("   Nama        :", STUDENT_NAME);
  console.log("   NIM         :", STUDENT_ID);
  console.log("   Wallet      :", STUDENT_WALLET);
  console.log("   CID         :", IPFS_CID);

  const txRegister = await contract.registerCertificate(
    DOCUMENT_ID,
    IPFS_CID,
    STUDENT_NAME,
    STUDENT_ID,
    STUDENT_WALLET,
    DEGREE,
    MAJOR,
    METADATA_URI
  );

  const receipt = await txRegister.wait();
  if (!receipt) throw new Error("Transaction failed: receipt is null");
  console.log("\n===========================================");
  console.log("  REGISTRATION SUCCESSFUL!");
  console.log("===========================================");
  console.log("TX Hash    :", receipt.hash);
  console.log("Block      :", receipt.blockNumber);
  console.log("Gas Used   :", receipt.gasUsed.toString());
  console.log("===========================================\n");

  // Step 3: Verify that data is stored
  console.log("Step 3: Verifying data on blockchain...");
  const [cert, tokenId] = await contract.verifyByDocumentId(DOCUMENT_ID);
  console.log("   Token ID    :", tokenId.toString());
  console.log("   Nama        :", cert.studentName);
  console.log("   NIM         :", cert.studentId);
  console.log("   Jurusan     :", cert.major);
  console.log("   Gelar       :", cert.degree);
  console.log("   CID         :", cert.ipfsCID);
  console.log("   Valid       :", cert.isValid ? "YES" : "NO");
  console.log("   Issuer      :", cert.issuerName);
  console.log("\n   Certificate successfully verified on blockchain!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Registration failed:", error.message || error);
    process.exit(1);
  });
