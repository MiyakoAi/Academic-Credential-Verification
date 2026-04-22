import { network } from "hardhat";

const { ethers } = await network.create();

async function main() {
  // ===================================================
  // TESTING FILE REGISTER DI SMART CONTRACT [ISI DATA]
  // ===================================================
  const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

  const DOCUMENT_ID = "UMI-2022-13020220166";
  const IPFS_CID = "bafkreigqiuk3aamhalcmtcbbkiescno3htpm5dhmf6uacxdaqteuke2nci";
  const STUDENT_NAME = "Mugni Adji";
  const STUDENT_ID = "13020220166";
  const STUDENT_WALLET = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const DEGREE = "S1";
  const MAJOR = "Teknik Informatika";
  const METADATA_URI = "ipfs://bafkreid45kztvmuifrucy5oiqvjpazdrfvdmskrv5um2tostti3t5ohevi";
  // ===================================================

  console.log("===========================================");
  console.log("  Registrasi Sertifikat ke Blockchain");
  console.log("===========================================\n");

  // Ambil signer (Account #0 = owner = deployer)
  const [owner] = await ethers.getSigners();
  console.log("Pengirim transaksi (Owner):", owner.address);

  // Hubungkan ke smart contract yang sudah di-deploy
  const contract = await ethers.getContractAt("AcademicCertificate", CONTRACT_ADDRESS);

  // Step 1: Tambahkan owner sebagai issuer (agar bisa register)
  console.log("\nStep 1: Menambahkan owner sebagai issuer...");
  try {
    const txAddIssuer = await contract.addIssuer(owner.address, "Universitas Muslim Indonesia");
    await txAddIssuer.wait();
    console.log("   Issuer berhasil ditambahkan!");
  } catch (e: any) {
    if (e.message.includes("Issuer sudah terdaftar")) {
      console.log("   Issuer sudah terdaftar sebelumnya, lanjut...");
    } else {
      throw e;
    }
  }

  // Step 2: Register sertifikat (mint SBT ke wallet mahasiswa)
  console.log("\nStep 2: Mendaftarkan sertifikat ke blockchain...");
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
  if (!receipt) throw new Error("Transaksi gagal: receipt null");
  console.log("\n===========================================");
  console.log("  REGISTRASI BERHASIL!");
  console.log("===========================================");
  console.log("TX Hash    :", receipt.hash);
  console.log("Block      :", receipt.blockNumber);
  console.log("Gas Used   :", receipt.gasUsed.toString());
  console.log("===========================================\n");

  // Step 3: Verifikasi bahwa data sudah masuk
  console.log("Step 3: Memverifikasi data di blockchain...");
  const [cert, tokenId] = await contract.verifyByDocumentId(DOCUMENT_ID);
  console.log("   Token ID    :", tokenId.toString());
  console.log("   Nama        :", cert.studentName);
  console.log("   NIM         :", cert.studentId);
  console.log("   Jurusan     :", cert.major);
  console.log("   Gelar       :", cert.degree);
  console.log("   CID         :", cert.ipfsCID);
  console.log("   Valid       :", cert.isValid ? "YA" : "TIDAK");
  console.log("   Issuer      :", cert.issuerName);
  console.log("\n   Sertifikat berhasil terverifikasi di blockchain!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Registrasi gagal:", error.message || error);
    process.exit(1);
  });
