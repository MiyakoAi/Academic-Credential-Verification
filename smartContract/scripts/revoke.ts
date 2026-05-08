import { network } from "hardhat";
import "dotenv/config";

const { ethers } = await network.create();

async function main() {
  // ===================================================
  // TESTING FILE REVOKE DI SMART CONTRACT [ISI DATA]
  // ===================================================
  const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS!;

  const DOCUMENT_ID = "UMI-2022-13020220111"; // ID ijazah yang akan dicabut
  // ===================================================

  console.log("===========================================");
  console.log("  Revoke Certificate from Blockchain");
  console.log("===========================================\n");

  // Get signer (Account #0 = owner = deployer)
  const [owner] = await ethers.getSigners();
  console.log("Transaction sender (Owner):", owner.address);

  // Connect to the deployed smart contract
  const contract = await ethers.getContractAt("AcademicCertificate", CONTRACT_ADDRESS);

  // Step 1: Cek status ijazah sebelum dicabut
  console.log("\nStep 1: Checking certificate status before revocation...");
  const [certBefore, tokenIdBefore] = await contract.verifyByDocumentId(DOCUMENT_ID);
  console.log("   Document ID :", certBefore.documentId);
  console.log("   Token ID    :", tokenIdBefore.toString());
  console.log("   Nama        :", certBefore.studentName);
  console.log("   NIM         :", certBefore.studentId);
  console.log("   Jurusan     :", certBefore.major);
  console.log("   Gelar       :", certBefore.degree);
  console.log("   CID         :", certBefore.ipfsCID);
  console.log("   Wallet      :", certBefore.studentWallet);
  console.log("   Issuer      :", certBefore.issuerName);
  console.log("   Valid       :", certBefore.isValid ? "AKTIF" : "SUDAH DICABUT");

  // Cek apakah sudah dicabut sebelumnya
  if (!certBefore.isValid) {
    console.log("\nIjazah ini sudah dicabut sebelumnya. Tidak perlu dicabut lagi.");
    return;
  }

  // Step 2: Cek kepemilikan token (SBT masih ada di wallet mahasiswa?)
  console.log("\nStep 2: Checking SBT ownership...");
  try {
    const tokenOwner = await contract.ownerOf(tokenIdBefore);
    console.log("   SBT Owner   :", tokenOwner);
    console.log("   Match Wallet:", tokenOwner === certBefore.studentWallet ? "YES" : "NO");
  } catch {
    console.log("   SBT sudah tidak ada (kemungkinan sudah dibakar).");
  }

  // Step 3: Eksekusi pencabutan (Revoke & Burn SBT)
  console.log("\nStep 3: Executing revocation (burn SBT)...");
  console.log("   PERINGATAN: Tindakan ini TIDAK DAPAT DIBATALKAN!");
  console.log("   Mencabut ijazah:", DOCUMENT_ID);

  const startTime = Date.now();

  const txRevoke = await contract.revokeCertificate(DOCUMENT_ID);

  const receipt = await txRevoke.wait();
  if (!receipt) throw new Error("Transaction failed: receipt is null");

  const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(3);

  console.log("\n===========================================");
  console.log("    REVOCATION SUCCESSFUL!");
  console.log("===========================================");
  console.log("TX Hash    :", receipt.hash);
  console.log("Block      :", receipt.blockNumber);
  console.log("Gas Used   :", receipt.gasUsed.toString());
  console.log("TX Confirmation Time :", elapsedTime, "seconds (s)");
  console.log("===========================================\n");

  // Step 4: Verifikasi bahwa status sudah berubah
  console.log("Step 4: Verifying revocation on blockchain...");
  const [certAfter, tokenIdAfter] = await contract.verifyByDocumentId(DOCUMENT_ID);
  console.log("   Document ID :", certAfter.documentId);
  console.log("   Token ID    :", tokenIdAfter.toString());
  console.log("   Nama        :", certAfter.studentName);
  console.log("   NIM         :", certAfter.studentId);
  console.log("   Valid       :", certAfter.isValid ? "AKTIF" : "DICABUT");

  // Step 5: Cek apakah SBT sudah dibakar dari wallet mahasiswa
  console.log("\nStep 5: Confirming SBT has been burned...");
  try {
    const tokenOwnerAfter = await contract.ownerOf(tokenIdAfter);
    console.log("     SBT masih ada di wallet:", tokenOwnerAfter);
  } catch {
    console.log("     SBT berhasil dibakar! Token sudah tidak ada di wallet manapun.");
  }

  console.log("\n===========================================");
  console.log("  SUMMARY");
  console.log("===========================================");
  console.log("  Dokumen    :", DOCUMENT_ID);
  console.log("  Mahasiswa  :", certBefore.studentName, "(", certBefore.studentId, ")");
  console.log("  Status     :  DICABUT / INVALID");
  console.log("  SBT        :  DIBAKAR (Burned)");
  console.log("  Oleh       :", owner.address);
  console.log("===========================================");
  console.log("\n  Ijazah telah dicabut secara permanen dari blockchain.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Revocation failed:", error.message || error);
    process.exit(1);
  });
