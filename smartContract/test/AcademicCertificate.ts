import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("AcademicCertificate (Soulbound Token)", function () {
  // ============================================================
  //                     HELPER FUNCTIONS
  // ============================================================

  /**
   * Deploy contract dan return instance + signers
   */
  async function deployFixture() {
    const [owner, issuer, student, verifier, otherAccount] =
      await ethers.getSigners();
    const contract = await ethers.deployContract("AcademicCertificate");

    return { contract, owner, issuer, student, verifier, otherAccount };
  }

  /**
   * Deploy + tambahkan issuer + register sertifikat (mint SBT ke student)
   */
  async function deployWithCertificateFixture() {
    const { contract, owner, issuer, student, verifier, otherAccount } =
      await deployFixture();

    // Tambahkan issuer
    await contract.addIssuer(issuer.address, "Universitas Gadjah Mada");

    // Register sertifikat sebagai issuer → mint SBT ke student
    const contractAsIssuer = contract.connect(issuer);
    await contractAsIssuer.registerCertificate(
      "UMI-2022-13020220166",
      "QmX7b3e1LpHTzKsRoEaqbzCp5AuNpBSmk5pCiN4QiPzMar",
      "Mugni Adji",
      "13020220166",
      student.address,
      "S1",
      "Teknik Informatika",
      "ipfs://QmMetadataHash123456789"
    );

    return {
      contract,
      contractAsIssuer,
      owner,
      issuer,
      student,
      verifier,
      otherAccount,
    };
  }

  // ============================================================
  //                      DEPLOYMENT TESTS
  // ============================================================

  describe("Deployment", function () {
    it("Harus men-set deployer sebagai owner", async function () {
      const { contract, owner } = await deployFixture();
      expect(await contract.owner()).to.equal(owner.address);
    });

    it("Total sertifikat awal harus 0", async function () {
      const { contract } = await deployFixture();
      expect(await contract.totalCertificates()).to.equal(0n);
    });

    it("Nama token harus 'Academic Certificate SBT'", async function () {
      const { contract } = await deployFixture();
      expect(await contract.name()).to.equal("Academic Certificate SBT");
    });

    it("Symbol token harus 'ACSBT'", async function () {
      const { contract } = await deployFixture();
      expect(await contract.symbol()).to.equal("ACSBT");
    });
  });

  // ============================================================
  //                   ISSUER MANAGEMENT TESTS
  // ============================================================

  describe("Manajemen Issuer", function () {
    it("Owner harus bisa menambahkan issuer baru", async function () {
      const { contract, issuer } = await deployFixture();

      await expect(
        contract.addIssuer(issuer.address, "Universitas Muslim Indonesia")
      )
        .to.emit(contract, "IssuerAdded")
        .withArgs(issuer.address, "Universitas Muslim Indonesia", () => true);

      expect(await contract.authorizedIssuers(issuer.address)).to.be.true;
      expect(await contract.issuerNames(issuer.address)).to.equal(
        "Universitas Gadjah Mada"
      );
    });

    it("Non-owner tidak boleh menambahkan issuer", async function () {
      const { contract, issuer, otherAccount } = await deployFixture();

      const contractAsOther = contract.connect(otherAccount);
      await expect(
        contractAsOther.addIssuer(issuer.address, "Universitas Lain")
      ).to.be.revertedWith("Hanya owner yang dapat mengakses fungsi ini");
    });

    it("Tidak bisa menambahkan issuer dengan alamat zero", async function () {
      const { contract } = await deployFixture();

      await expect(
        contract.addIssuer(ethers.ZeroAddress, "Universitas ABC")
      ).to.be.revertedWith("Alamat issuer tidak valid");
    });

    it("Tidak bisa menambahkan issuer dengan nama kosong", async function () {
      const { contract, issuer } = await deployFixture();

      await expect(contract.addIssuer(issuer.address, "")).to.be.revertedWith(
        "Nama issuer tidak boleh kosong"
      );
    });

    it("Tidak bisa menambahkan issuer yang sudah terdaftar", async function () {
      const { contract, issuer } = await deployFixture();

      await contract.addIssuer(issuer.address, "Universitas Muslim Indonesia");

      await expect(
        contract.addIssuer(issuer.address, "Universitas Muslim Indonesia")
      ).to.be.revertedWith("Issuer sudah terdaftar");
    });

    it("Owner harus bisa menghapus issuer", async function () {
      const { contract, issuer } = await deployFixture();

      await contract.addIssuer(issuer.address, "Universitas Muslim Indonesia");

      await expect(contract.removeIssuer(issuer.address))
        .to.emit(contract, "IssuerRemoved")
        .withArgs(issuer.address, () => true);

      expect(await contract.authorizedIssuers(issuer.address)).to.be.false;
    });

    it("Tidak bisa menghapus issuer yang tidak terdaftar", async function () {
      const { contract, otherAccount } = await deployFixture();

      await expect(
        contract.removeIssuer(otherAccount.address)
      ).to.be.revertedWith("Issuer tidak ditemukan");
    });
  });

  // ============================================================
  //            CERTIFICATE REGISTRATION (SBT MINT) TESTS
  // ============================================================

  describe("Registrasi Sertifikat (Mint SBT)", function () {
    it("Issuer harus bisa mendaftarkan sertifikat dan mint SBT ke mahasiswa", async function () {
      const { contract, issuer, student } = await deployFixture();

      await contract.addIssuer(issuer.address, "Universitas Muslim Indonesia");

      const contractAsIssuer = contract.connect(issuer);
      await expect(
        contractAsIssuer.registerCertificate(
          "UMI-2022-13020220166",
          "QmX7b3e1LpHTzKsRoEaqbzCp5AuNpBSmk5pCiN4QiPzMar",
          "Mugni Adji",
          "13020220166",
          student.address,
          "S1",
          "Teknik Informatika",
          "ipfs://QmMetadataHash123456789"
        )
      )
        .to.emit(contract, "CertificateRegistered")
        .withArgs(
          "UMI-2022-13020220166",
          1n, // tokenId pertama = 1
          "QmX7b3e1LpHTzKsRoEaqbzCp5AuNpBSmk5pCiN4QiPzMar",
          student.address,
          issuer.address,
          "Mugni Adji",
          "13020220166",
          () => true
        );

      expect(await contract.totalCertificates()).to.equal(1n);
    });

    it("SBT harus dimiliki oleh wallet mahasiswa setelah mint", async function () {
      const { contract, student } = await deployWithCertificateFixture();

      // Token ID 1 harus dimiliki oleh student
      expect(await contract.ownerOf(1n)).to.equal(student.address);

      // Balance student harus 1
      expect(await contract.balanceOf(student.address)).to.equal(1n);
    });

    it("TokenURI harus sesuai dengan metadata URI yang di-set", async function () {
      const { contract } = await deployWithCertificateFixture();

      const uri = await contract.tokenURI(1n);
      expect(uri).to.equal("ipfs://QmMetadataHash123456789");
    });

    it("DocumentId dan TokenId harus saling terhubung (mapping dua arah)", async function () {
      const { contract } = await deployWithCertificateFixture();

      // documentId -> tokenId
      expect(await contract.documentToTokenId("UMI-2022-13020220166")).to.equal(1n);

      // tokenId -> documentId
      expect(await contract.tokenToDocumentId(1n)).to.equal("UMI-2022-13020220166");
    });

    it("Non-issuer tidak boleh mendaftarkan sertifikat", async function () {
      const { contract, otherAccount, student } = await deployFixture();

      const contractAsOther = contract.connect(otherAccount);
      await expect(
        contractAsOther.registerCertificate(
          "UMI-2022-13020220166",
          "QmX7b3e1LpHTzKsRoEaqbzCp5AuNpBSmk5pCiN4QiPzMar",
          "Mugni Adji",
          "13020220166",
          student.address,
          "S1",
          "Teknik Informatika",
          ""
        )
      ).to.be.revertedWith(
        "Hanya issuer yang berwenang yang dapat mengakses fungsi ini"
      );
    });

    it("Tidak bisa mendaftarkan sertifikat dengan documentId yang sama", async function () {
      const { contractAsIssuer, otherAccount } =
        await deployWithCertificateFixture();

      await expect(
        contractAsIssuer.registerCertificate(
          "UMI-2022-13020220166", // duplicate ID
          "QmDifferentCID",
          "Mugni Adji",
          "13020220166",
          otherAccount.address,
          "S1",
          "Teknik Informatika",
          ""
        )
      ).to.be.revertedWith("Dokumen dengan ID ini sudah terdaftar");
    });

    it("Tidak bisa mendaftarkan dengan wallet mahasiswa zero address", async function () {
      const { contract, issuer } = await deployFixture();
      await contract.addIssuer(issuer.address, "Universitas Muslim Indonesia");
      const contractAsIssuer = contract.connect(issuer);

      await expect(
        contractAsIssuer.registerCertificate(
          "UMI-2022-13020220166",
          "QmX7b3e1LpHTzKsRoEaqbzCp5AuNpBSmk5pCiN4QiPzMar",
          "Mugni Adji",
          "13020220166",
          ethers.ZeroAddress,
          "S1",
          "Teknik Informatika",
          ""
        )
      ).to.be.revertedWith("Alamat wallet mahasiswa tidak valid");
    });

    it("Tidak bisa mendaftarkan dengan CID kosong", async function () {
      const { contract, issuer, student } = await deployFixture();
      await contract.addIssuer(issuer.address, "Universitas Muslim Indonesia");
      const contractAsIssuer = contract.connect(issuer);

      await expect(
        contractAsIssuer.registerCertificate(
          "UMI-2022-13020220166",
          "",
          "Budi Santoso",
          "20/504900/TK/51234",
          student.address,
          "S1",
          "Teknik Informatika",
          ""
        )
      ).to.be.revertedWith("IPFS CID tidak boleh kosong");
    });

    it("Token ID harus auto-increment untuk setiap sertifikat baru", async function () {
      const { contract, contractAsIssuer, otherAccount } =
        await deployWithCertificateFixture();

      // Register sertifikat kedua
      await contractAsIssuer.registerCertificate(
        "UMI-2022-13020220167",
        "QmY8c4f2MqIUaLtRoFbrzDp6BwOpCSmk6qDkO5RkQaBcd",
        "Katezuki",
        "13020220167",
        otherAccount.address,
        "S1",
        "Sistem Informasi",
        ""
      );

      expect(await contract.documentToTokenId("UMI-2022-13020220166")).to.equal(1n);
      expect(await contract.documentToTokenId("UMI-2022-13020220167")).to.equal(2n);
    });
  });

  // ============================================================
  //              SOULBOUND TOKEN RESTRICTION TESTS
  // ============================================================

  describe("Soulbound Restriction (Non-transferable)", function () {
    it("Student TIDAK boleh transfer SBT ke orang lain", async function () {
      const { contract, student, otherAccount } =
        await deployWithCertificateFixture();

      const contractAsStudent = contract.connect(student);

      await expect(
        contractAsStudent.transferFrom(
          student.address,
          otherAccount.address,
          1n
        )
      ).to.be.revertedWith("Soulbound Token: token tidak dapat ditransfer");
    });

    it("Student TIDAK boleh safeTransferFrom SBT", async function () {
      const { contract, student, otherAccount } =
        await deployWithCertificateFixture();

      const contractAsStudent = contract.connect(student);

      // safeTransferFrom(address,address,uint256)
      await expect(
        contractAsStudent["safeTransferFrom(address,address,uint256)"](
          student.address,
          otherAccount.address,
          1n
        )
      ).to.be.revertedWith("Soulbound Token: token tidak dapat ditransfer");
    });

    it("Student TIDAK boleh approve SBT ke orang lain", async function () {
      const { contract, student, otherAccount } =
        await deployWithCertificateFixture();

      const contractAsStudent = contract.connect(student);

      await expect(
        contractAsStudent.approve(otherAccount.address, 1n)
      ).to.be.revertedWith("Soulbound Token: approval tidak diizinkan");
    });

    it("Student TIDAK boleh setApprovalForAll", async function () {
      const { contract, student, otherAccount } =
        await deployWithCertificateFixture();

      const contractAsStudent = contract.connect(student);

      await expect(
        contractAsStudent.setApprovalForAll(otherAccount.address, true)
      ).to.be.revertedWith("Soulbound Token: approval tidak diizinkan");
    });
  });

  // ============================================================
  //                 CERTIFICATE RETRIEVAL TESTS
  // ============================================================

  describe("Pengambilan Data Sertifikat", function () {
    it("Harus bisa mengambil data sertifikat yang valid (struct)", async function () {
      const { contract, issuer, student } =
        await deployWithCertificateFixture();

      const [cert, tokenId] = await contract.getCertificate("UMI-2022-13020220166");

      expect(cert.ipfsCID).to.equal(
        "QmX7b3e1LpHTzKsRoEaqbzCp5AuNpBSmk5pCiN4QiPzMar"
      );
      expect(cert.studentName).to.equal("Mugni Adji");
      expect(cert.studentId).to.equal("13020220166");
      expect(cert.studentWallet).to.equal(student.address);
      expect(cert.degree).to.equal("S1");
      expect(cert.major).to.equal("Teknik Informatika");
      expect(cert.issuerAddress).to.equal(issuer.address);
      expect(cert.issuerName).to.equal("Universitas Muslim Indonesia");
      expect(cert.isValid).to.be.true;
      expect(tokenId).to.equal(1n);
    });

    it("Harus revert jika documentId tidak ditemukan", async function () {
      const { contract } = await deployFixture();

      await expect(
        contract.getCertificate("TIDAK-ADA-12345")
      ).to.be.revertedWith("Dokumen dengan ID ini tidak ditemukan");
    });

    it("Harus bisa mengambil CID saja", async function () {
      const { contract } = await deployWithCertificateFixture();

      const cid = await contract.getCID("UMI-2022-13020220166");
      expect(cid).to.equal(
        "QmX7b3e1LpHTzKsRoEaqbzCp5AuNpBSmk5pCiN4QiPzMar"
      );
    });

    it("Harus bisa mengambil tokenId dari documentId", async function () {
      const { contract } = await deployWithCertificateFixture();

      expect(await contract.getTokenId("UMI-2022-13020220166")).to.equal(1n);
    });

    it("Harus bisa mengambil documentId dari tokenId", async function () {
      const { contract } = await deployWithCertificateFixture();

      expect(await contract.getDocumentId(1n)).to.equal("UMI-2022-13020220166");
    });
  });

  // ============================================================
  //                CERTIFICATE VERIFICATION TESTS
  // ============================================================

  describe("Verifikasi Sertifikat", function () {
    it("Harus bisa memverifikasi sertifikat dengan CID yang benar", async function () {
      const { contract, issuer, student } =
        await deployWithCertificateFixture();

      const result = await contract.verifyCertificate.staticCall(
        "UMI-2022-13020220166",
        "QmX7b3e1LpHTzKsRoEaqbzCp5AuNpBSmk5pCiN4QiPzMar"
      );

      expect(result.isValid).to.be.true;
      expect(result.isMatching).to.be.true;
      expect(result.cert.ipfsCID).to.equal(
        "QmX7b3e1LpHTzKsRoEaqbzCp5AuNpBSmk5pCiN4QiPzMar"
      );
      expect(result.cert.issuerAddress).to.equal(issuer.address);
      expect(result.cert.issuerName).to.equal("Universitas Muslim Indonesia");
      expect(result.tokenId).to.equal(1n);
      expect(result.tokenOwner).to.equal(student.address);
    });

    it("Harus mendeteksi CID yang tidak cocok (dokumen palsu)", async function () {
      const { contract } = await deployWithCertificateFixture();

      const result = await contract.verifyCertificate.staticCall(
        "UMI-2022-13020220166",
        "QmFAKECID_ini_bukan_cid_asli"
      );

      expect(result.isValid).to.be.true;
      expect(result.isMatching).to.be.false; // CID tidak cocok!
    });

    it("Harus bisa verifikasi berdasarkan documentId saja (QR Code scan)", async function () {
      const { contract, student } = await deployWithCertificateFixture();

      const [cert, tokenId] = await contract.verifyByDocumentId("UMI-2022-13020220166");

      expect(cert.isValid).to.be.true;
      expect(cert.ipfsCID).to.equal(
        "QmX7b3e1LpHTzKsRoEaqbzCp5AuNpBSmk5pCiN4QiPzMar"
      );
      expect(cert.studentName).to.equal("Mugni Adji");
      expect(cert.studentId).to.equal("13020220166");
      expect(cert.studentWallet).to.equal(student.address);
      expect(cert.degree).to.equal("S1");
      expect(cert.major).to.equal("Teknik Informatika");
      expect(cert.issuerName).to.equal("Universitas Muslim Indonesia");
      expect(tokenId).to.equal(1n);
    });

    it("Harus emit CertificateVerified event saat verifikasi", async function () {
      const { contract, verifier } = await deployWithCertificateFixture();

      const contractAsVerifier = contract.connect(verifier);

      await expect(
        contractAsVerifier.verifyCertificate(
          "UMI-2022-13020220166",
          "QmX7b3e1LpHTzKsRoEaqbzCp5AuNpBSmk5pCiN4QiPzMar"
        )
      )
        .to.emit(contract, "CertificateVerified")
        .withArgs("UMI-2022-13020220166", verifier.address, true, () => true);
    });
  });

  // ============================================================
  //            CERTIFICATE REVOCATION (BURN SBT) TESTS
  // ============================================================

  describe("Pencabutan Sertifikat (Burn SBT)", function () {
    it("Issuer asli harus bisa mencabut sertifikat (burn SBT)", async function () {
      const { contractAsIssuer, contract, issuer, student } =
        await deployWithCertificateFixture();

      await expect(contractAsIssuer.revokeCertificate("UMI-2022-13020220166"))
        .to.emit(contract, "CertificateRevoked")
        .withArgs("UMI-2022-13020220166", 1n, issuer.address, () => true);

      // Sertifikat harus invalid
      const [cert] = await contract.getCertificate("UMI-2022-13020220166");
      expect(cert.isValid).to.be.false;

      // Balance student harus 0 (token di-burn)
      expect(await contract.balanceOf(student.address)).to.equal(0n);
    });

    it("Owner harus bisa mencabut sertifikat apapun", async function () {
      const { contract, student } = await deployWithCertificateFixture();

      await expect(contract.revokeCertificate("UMI-2022-13020220166")).to.emit(
        contract,
        "CertificateRevoked"
      );

      const [cert] = await contract.getCertificate("UMI-2022-13020220166");
      expect(cert.isValid).to.be.false;

      expect(await contract.balanceOf(student.address)).to.equal(0n);
    });

    it("Pihak lain tidak boleh mencabut sertifikat", async function () {
      const { contract, otherAccount } =
        await deployWithCertificateFixture();

      const contractAsOther = contract.connect(otherAccount);
      await expect(
        contractAsOther.revokeCertificate("UMI-2022-13020220166")
      ).to.be.revertedWith(
        "Hanya issuer asli atau owner yang dapat mencabut sertifikat"
      );
    });

    it("Student TIDAK boleh mencabut sertifikat sendiri", async function () {
      const { contract, student } = await deployWithCertificateFixture();

      const contractAsStudent = contract.connect(student);
      await expect(
        contractAsStudent.revokeCertificate("UMI-2022-13020220166")
      ).to.be.revertedWith(
        "Hanya issuer asli atau owner yang dapat mencabut sertifikat"
      );
    });

    it("Tidak bisa mencabut sertifikat yang sudah di-revoke", async function () {
      const { contractAsIssuer } = await deployWithCertificateFixture();

      await contractAsIssuer.revokeCertificate("UMI-2022-13020220166");

      await expect(
        contractAsIssuer.revokeCertificate("UMI-2022-13020220166")
      ).to.be.revertedWith("Sertifikat sudah di-revoke sebelumnya");
    });

    it("Verifikasi sertifikat yang di-revoke harus menunjukkan invalid", async function () {
      const { contract, contractAsIssuer } =
        await deployWithCertificateFixture();

      await contractAsIssuer.revokeCertificate("UMI-2022-13020220166");

      const result = await contract.verifyCertificate.staticCall(
        "UMI-2022-13020220166",
        "QmX7b3e1LpHTzKsRoEaqbzCp5AuNpBSmk5pCiN4QiPzMar"
      );

      expect(result.isValid).to.be.false;
      expect(result.tokenOwner).to.equal(ethers.ZeroAddress); // token burned
    });
  });

  // ============================================================
  //                     UTILITY FUNCTION TESTS
  // ============================================================

  describe("Fungsi Utilitas", function () {
    it("Harus bisa mengecek keberadaan sertifikat", async function () {
      const { contract } = await deployWithCertificateFixture();

      expect(await contract.certificateExists("UMI-2022-13020220166")).to.be.true;
      expect(await contract.certificateExists("TIDAK-ADA")).to.be.false;
    });

    it("Harus bisa mengambil semua documentId", async function () {
      const { contract, contractAsIssuer, otherAccount } =
        await deployWithCertificateFixture();

      await contractAsIssuer.registerCertificate(
        "UMI-2022-13020220167",
        "QmY8c4f2MqIUaLtRoFbrzDp6BwOpCSmk6qDkO5RkQaBcd",
        "Katezuki",
        "13020220167",
        otherAccount.address,
        "S1",
        "Sistem Informasi",
        ""
      );

      const allIds = await contract.getAllDocumentIds();
      expect(allIds.length).to.equal(2);
      expect(allIds[0]).to.equal("UMI-2022-13020220166");
      expect(allIds[1]).to.equal("UMI-2022-13020220167");
    });

    it("Total sertifikat harus bertambah setiap registrasi", async function () {
      const { contract, contractAsIssuer, otherAccount } =
        await deployWithCertificateFixture();

      expect(await contract.totalCertificates()).to.equal(1n);

      await contractAsIssuer.registerCertificate(
        "UMI-2022-13020220167",
        "QmY8c4f2MqIUaLtRoFbrzDp6BwOpCSmk6qDkO5RkQaBcd",
        "Katezuki",
        "13020220167",
        otherAccount.address,
        "S1",
        "Sistem Informasi",
        ""
      );

      expect(await contract.totalCertificates()).to.equal(2n);
    });

    it("Owner harus bisa transfer ownership", async function () {
      const { contract, otherAccount } = await deployFixture();

      await contract.transferOwnership(otherAccount.address);
      expect(await contract.owner()).to.equal(otherAccount.address);
    });

    it("Tidak bisa transfer ownership ke address zero", async function () {
      const { contract } = await deployFixture();

      await expect(
        contract.transferOwnership(ethers.ZeroAddress)
      ).to.be.revertedWith("Alamat owner baru tidak valid");
    });

    it("supportsInterface harus mendukung ERC-721", async function () {
      const { contract } = await deployFixture();

      // ERC-721 interfaceId = 0x80ac58cd
      expect(await contract.supportsInterface("0x80ac58cd")).to.be.true;
    });
  });

  // ============================================================
  //                      INTEGRATION TESTS
  // ============================================================

  describe("Integrasi: Alur Lengkap Registrasi SBT dan Verifikasi", function () {
    it("Alur lengkap: deploy → add issuer → register (mint SBT) → verify → revoke (burn SBT)", async function () {
      const [owner, issuer, student, verifier] = await ethers.getSigners();
      const contract = await ethers.deployContract("AcademicCertificate");

      // Step 1: Owner menambahkan issuer
      await contract.addIssuer(
        issuer.address,
        "Institut Teknologi Bandung"
      );
      expect(await contract.authorizedIssuers(issuer.address)).to.be.true;

      // Step 2: Issuer mendaftarkan sertifikat (mint SBT ke student)
      const contractAsIssuer = contract.connect(issuer);
      await contractAsIssuer.registerCertificate(
        "ITB-2024-00001",
        "QmAbCdEfGhIjKlMnOpQrStUvWxYz1234567890abcdef",
        "Dewi Lestari",
        "13519001",
        student.address,
        "S1",
        "Teknik Informatika",
        "ipfs://QmMetadataITB001"
      );

      // Step 3: Verifikasi SBT ada di wallet student
      expect(await contract.ownerOf(1n)).to.equal(student.address);
      expect(await contract.balanceOf(student.address)).to.equal(1n);
      expect(await contract.tokenURI(1n)).to.equal("ipfs://QmMetadataITB001");

      // Step 4: Student TIDAK bisa transfer SBT
      const contractAsStudent = contract.connect(student);
      await expect(
        contractAsStudent.transferFrom(
          student.address,
          verifier.address,
          1n
        )
      ).to.be.revertedWith("Soulbound Token: token tidak dapat ditransfer");

      // Step 5: Verifier memverifikasi via QR Code scan (struct return)
      const [verifyCert, verifyTokenId] = await contract.verifyByDocumentId("ITB-2024-00001");
      expect(verifyCert.isValid).to.be.true;
      expect(verifyCert.studentName).to.equal("Dewi Lestari");
      expect(verifyCert.studentWallet).to.equal(student.address);
      expect(verifyTokenId).to.equal(1n);

      // Step 6: Deep verification dengan CID
      const deepVerify = await contract.verifyCertificate.staticCall(
        "ITB-2024-00001",
        "QmAbCdEfGhIjKlMnOpQrStUvWxYz1234567890abcdef"
      );
      expect(deepVerify.isValid).to.be.true;
      expect(deepVerify.isMatching).to.be.true;
      expect(deepVerify.tokenOwner).to.equal(student.address);

      // Step 7: Issuer mencabut sertifikat (burn SBT)
      await contractAsIssuer.revokeCertificate("ITB-2024-00001");

      // Step 8: SBT sudah tidak ada di wallet student
      expect(await contract.balanceOf(student.address)).to.equal(0n);

      // Step 9: Verifikasi setelah revoke menunjukkan invalid (struct return)
      const [afterRevokeCert] = await contract.verifyByDocumentId("ITB-2024-00001");
      expect(afterRevokeCert.isValid).to.be.false;
    });
  });
});
