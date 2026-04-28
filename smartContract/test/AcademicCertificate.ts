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

    // Add issuer
    await contract.addIssuer(issuer.address, "Universitas Muslim Indonesia");

    // Register certificate as issuer → mint SBT to student
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
    it("Should set deployer as owner", async function () {
      const { contract, owner } = await deployFixture();
      expect(await contract.owner()).to.equal(owner.address);
    });

    it("Initial total certificates should be 0", async function () {
      const { contract } = await deployFixture();
      expect(await contract.totalCertificates()).to.equal(0n);
    });

    it("Token name should be 'Academic Certificate SBT'", async function () {
      const { contract } = await deployFixture();
      expect(await contract.name()).to.equal("Academic Certificate SBT");
    });

    it("Token symbol should be 'ACSBT'", async function () {
      const { contract } = await deployFixture();
      expect(await contract.symbol()).to.equal("ACSBT");
    });
  });

  // ============================================================
  //                   ISSUER MANAGEMENT TESTS
  // ============================================================

  describe("Issuer Management", function () {
    it("Owner should be able to add a new issuer", async function () {
      const { contract, issuer } = await deployFixture();

      await expect(
        contract.addIssuer(issuer.address, "Universitas Muslim Indonesia")
      )
        .to.emit(contract, "IssuerAdded")
        .withArgs(issuer.address, "Universitas Muslim Indonesia", () => true);

      expect(await contract.authorizedIssuers(issuer.address)).to.be.true;
      expect(await contract.issuerNames(issuer.address)).to.equal(
        "Universitas Muslim Indonesia"
      );
    });

    it("Non-owner should not be able to add issuer", async function () {
      const { contract, issuer, otherAccount } = await deployFixture();

      const contractAsOther = contract.connect(otherAccount);
      await expect(
        contractAsOther.addIssuer(issuer.address, "Universitas Lain")
      ).to.be.revertedWith("Only the owner can access this function");
    });

    it("Cannot add issuer with zero address", async function () {
      const { contract } = await deployFixture();

      await expect(
        contract.addIssuer(ethers.ZeroAddress, "Universitas ABC")
      ).to.be.revertedWith("Invalid issuer address");
    });

    it("Cannot add issuer with empty name", async function () {
      const { contract, issuer } = await deployFixture();

      await expect(contract.addIssuer(issuer.address, "")).to.be.revertedWith(
        "Issuer name cannot be empty"
      );
    });

    it("Cannot add an already registered issuer", async function () {
      const { contract, issuer } = await deployFixture();

      await contract.addIssuer(issuer.address, "Universitas Muslim Indonesia");

      await expect(
        contract.addIssuer(issuer.address, "Universitas Muslim Indonesia")
      ).to.be.revertedWith("Issuer is already registered");
    });

    it("Owner should be able to remove an issuer", async function () {
      const { contract, issuer } = await deployFixture();

      await contract.addIssuer(issuer.address, "Universitas Muslim Indonesia");

      await expect(contract.removeIssuer(issuer.address))
        .to.emit(contract, "IssuerRemoved")
        .withArgs(issuer.address, () => true);

      expect(await contract.authorizedIssuers(issuer.address)).to.be.false;
    });

    it("Cannot remove an unregistered issuer", async function () {
      const { contract, otherAccount } = await deployFixture();

      await expect(
        contract.removeIssuer(otherAccount.address)
      ).to.be.revertedWith("Issuer not found");
    });
  });

  // ============================================================
  //            CERTIFICATE REGISTRATION (SBT MINT) TESTS
  // ============================================================

  describe("Certificate Registration (Mint SBT)", function () {
    it("Issuer should be able to register a certificate and mint SBT to student", async function () {
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

    it("SBT should be owned by the student wallet after minting", async function () {
      const { contract, student } = await deployWithCertificateFixture();

      // Token ID 1 must be owned by student
      expect(await contract.ownerOf(1n)).to.equal(student.address);

      // Student balance should be 1
      expect(await contract.balanceOf(student.address)).to.equal(1n);
    });

    it("TokenURI should match the set metadata URI", async function () {
      const { contract } = await deployWithCertificateFixture();

      const uri = await contract.tokenURI(1n);
      expect(uri).to.equal("ipfs://QmMetadataHash123456789");
    });

    it("DocumentId and TokenId should be linked (bidirectional mapping)", async function () {
      const { contract } = await deployWithCertificateFixture();

      // documentId -> tokenId
      expect(await contract.documentToTokenId("UMI-2022-13020220166")).to.equal(1n);

      // tokenId -> documentId
      expect(await contract.tokenToDocumentId(1n)).to.equal("UMI-2022-13020220166");
    });

    it("Non-issuer should not be able to register a certificate", async function () {
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
        "Only authorized issuers can access this function"
      );
    });

    it("Cannot register a certificate with a duplicate documentId", async function () {
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
      ).to.be.revertedWith("Document with this ID is already registered");
    });

    it("Cannot register with zero address student wallet", async function () {
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
      ).to.be.revertedWith("Invalid student wallet address");
    });

    it("Cannot register with empty CID", async function () {
      const { contract, issuer, student } = await deployFixture();
      await contract.addIssuer(issuer.address, "Universitas Muslim Indonesia");
      const contractAsIssuer = contract.connect(issuer);

      await expect(
        contractAsIssuer.registerCertificate(
          "UMI-2022-13020220166",
          "",
          "Mugni Adji",
          "13020220166",
          student.address,
          "S1",
          "Teknik Informatika",
          ""
        )
      ).to.be.revertedWith("IPFS CID cannot be empty");
    });

    it("Token ID should auto-increment for each new certificate", async function () {
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
    it("Student MUST NOT transfer SBT to others", async function () {
      const { contract, student, otherAccount } =
        await deployWithCertificateFixture();

      const contractAsStudent = contract.connect(student);

      await expect(
        contractAsStudent.transferFrom(
          student.address,
          otherAccount.address,
          1n
        )
      ).to.be.revertedWith("Soulbound Token: token is non-transferable");
    });

    it("Student MUST NOT safeTransferFrom SBT", async function () {
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
      ).to.be.revertedWith("Soulbound Token: token is non-transferable");
    });

    it("Student MUST NOT approve SBT to others", async function () {
      const { contract, student, otherAccount } =
        await deployWithCertificateFixture();

      const contractAsStudent = contract.connect(student);

      await expect(
        contractAsStudent.approve(otherAccount.address, 1n)
      ).to.be.revertedWith("Soulbound Token: approval is not allowed");
    });

    it("Student MUST NOT setApprovalForAll", async function () {
      const { contract, student, otherAccount } =
        await deployWithCertificateFixture();

      const contractAsStudent = contract.connect(student);

      await expect(
        contractAsStudent.setApprovalForAll(otherAccount.address, true)
      ).to.be.revertedWith("Soulbound Token: approval is not allowed");
    });
  });

  // ============================================================
  //                 CERTIFICATE RETRIEVAL TESTS
  // ============================================================

  describe("Certificate Data Retrieval", function () {
    it("Should retrieve valid certificate data (struct)", async function () {
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

    it("Should revert if documentId not found", async function () {
      const { contract } = await deployFixture();

      await expect(
        contract.getCertificate("TIDAK-ADA-12345")
      ).to.be.revertedWith("Document with this ID was not found");
    });

    it("Should retrieve CID only", async function () {
      const { contract } = await deployWithCertificateFixture();

      const cid = await contract.getCID("UMI-2022-13020220166");
      expect(cid).to.equal(
        "QmX7b3e1LpHTzKsRoEaqbzCp5AuNpBSmk5pCiN4QiPzMar"
      );
    });

    it("Should retrieve tokenId from documentId", async function () {
      const { contract } = await deployWithCertificateFixture();

      expect(await contract.getTokenId("UMI-2022-13020220166")).to.equal(1n);
    });

    it("Should retrieve documentId from tokenId", async function () {
      const { contract } = await deployWithCertificateFixture();

      expect(await contract.getDocumentId(1n)).to.equal("UMI-2022-13020220166");
    });
  });

  // ============================================================
  //                CERTIFICATE VERIFICATION TESTS
  // ============================================================

  describe("Certificate Verification", function () {
    it("Should verify certificate with correct CID", async function () {
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

    it("Should detect mismatched CID (forged document)", async function () {
      const { contract } = await deployWithCertificateFixture();

      const result = await contract.verifyCertificate.staticCall(
        "UMI-2022-13020220166",
        "QmFAKECID_ini_bukan_cid_asli"
      );

      expect(result.isValid).to.be.true;
      expect(result.isMatching).to.be.false; // CID does not match!
    });

    it("Should verify by documentId only (QR Code scan)", async function () {
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

    it("Should emit CertificateVerified event on verification", async function () {
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

  describe("Certificate Revocation (Burn SBT)", function () {
    it("Original issuer should be able to revoke certificate (burn SBT)", async function () {
      const { contractAsIssuer, contract, issuer, student } =
        await deployWithCertificateFixture();

      await expect(contractAsIssuer.revokeCertificate("UMI-2022-13020220166"))
        .to.emit(contract, "CertificateRevoked")
        .withArgs("UMI-2022-13020220166", 1n, issuer.address, () => true);

      // Certificate should be invalid
      const [cert] = await contract.getCertificate("UMI-2022-13020220166");
      expect(cert.isValid).to.be.false;

      // Student balance should be 0 (token burned)
      expect(await contract.balanceOf(student.address)).to.equal(0n);
    });

    it("Owner should be able to revoke any certificate", async function () {
      const { contract, student } = await deployWithCertificateFixture();

      await expect(contract.revokeCertificate("UMI-2022-13020220166")).to.emit(
        contract,
        "CertificateRevoked"
      );

      const [cert] = await contract.getCertificate("UMI-2022-13020220166");
      expect(cert.isValid).to.be.false;

      expect(await contract.balanceOf(student.address)).to.equal(0n);
    });

    it("Others should not be able to revoke a certificate", async function () {
      const { contract, otherAccount } =
        await deployWithCertificateFixture();

      const contractAsOther = contract.connect(otherAccount);
      await expect(
        contractAsOther.revokeCertificate("UMI-2022-13020220166")
      ).to.be.revertedWith(
        "Only the original issuer or owner can revoke a certificate"
      );
    });

    it("Student MUST NOT revoke their own certificate", async function () {
      const { contract, student } = await deployWithCertificateFixture();

      const contractAsStudent = contract.connect(student);
      await expect(
        contractAsStudent.revokeCertificate("UMI-2022-13020220166")
      ).to.be.revertedWith(
        "Only the original issuer or owner can revoke a certificate"
      );
    });

    it("Cannot revoke an already revoked certificate", async function () {
      const { contractAsIssuer } = await deployWithCertificateFixture();

      await contractAsIssuer.revokeCertificate("UMI-2022-13020220166");

      await expect(
        contractAsIssuer.revokeCertificate("UMI-2022-13020220166")
      ).to.be.revertedWith("Certificate has already been revoked");
    });

    it("Verification of revoked certificate should show invalid", async function () {
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

  describe("Utility Functions", function () {
    it("Should check certificate existence", async function () {
      const { contract } = await deployWithCertificateFixture();

      expect(await contract.certificateExists("UMI-2022-13020220166")).to.be.true;
      expect(await contract.certificateExists("TIDAK-ADA")).to.be.false;
    });

    it("Should retrieve all documentIds", async function () {
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

    it("Total certificates should increment on each registration", async function () {
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

    it("Owner should be able to transfer ownership", async function () {
      const { contract, otherAccount } = await deployFixture();

      await contract.transferOwnership(otherAccount.address);
      expect(await contract.owner()).to.equal(otherAccount.address);
    });

    it("Cannot transfer ownership to zero address", async function () {
      const { contract } = await deployFixture();

      await expect(
        contract.transferOwnership(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid new owner address");
    });

    it("supportsInterface should support ERC-721", async function () {
      const { contract } = await deployFixture();

      // ERC-721 interfaceId = 0x80ac58cd
      expect(await contract.supportsInterface("0x80ac58cd")).to.be.true;
    });
  });

  // ============================================================
  //                      INTEGRATION TESTS
  // ============================================================

  describe("Integration: Full SBT Registration and Verification Flow", function () {
    it("Full flow: deploy → add issuer → register (mint SBT) → verify → revoke (burn SBT)", async function () {
      const [owner, issuer, student, verifier] = await ethers.getSigners();
      const contract = await ethers.deployContract("AcademicCertificate");

      // Step 1: Owner menambahkan issuer
      await contract.addIssuer(
        issuer.address,
        "Universitas Hasanuddin"
      );
      expect(await contract.authorizedIssuers(issuer.address)).to.be.true;

      // Step 2: Issuer mendaftarkan sertifikat (mint SBT ke student)
      const contractAsIssuer = contract.connect(issuer);
      await contractAsIssuer.registerCertificate(
        "Unhas-2022-00020220001",
        "QmAbCdEfGhIjKlMnOpQrStUvWxYz1234567890abcdef",
        "Miyako",
        "00020220001",
        student.address,
        "S1",
        "Teknik Informatika",
        "ipfs://QmMetadataUnhas001"
      );

      // Step 3: Verifikasi SBT ada di wallet student
      expect(await contract.ownerOf(1n)).to.equal(student.address);
      expect(await contract.balanceOf(student.address)).to.equal(1n);
      expect(await contract.tokenURI(1n)).to.equal("ipfs://QmMetadataUnhas001");

      // Step 4: Student TIDAK bisa transfer SBT
      const contractAsStudent = contract.connect(student);
      await expect(
        contractAsStudent.transferFrom(
          student.address,
          verifier.address,
          1n
        )
      ).to.be.revertedWith("Soulbound Token: token is non-transferable");

      // Step 5: Verifier memverifikasi via QR Code scan (struct return)
      const [verifyCert, verifyTokenId] = await contract.verifyByDocumentId("Unhas-2022-00020220001");
      expect(verifyCert.isValid).to.be.true;
      expect(verifyCert.studentName).to.equal("Miyako");
      expect(verifyCert.studentWallet).to.equal(student.address);
      expect(verifyTokenId).to.equal(1n);

      // Step 6: Deep verification dengan CID
      const deepVerify = await contract.verifyCertificate.staticCall(
        "Unhas-2022-00020220001",
        "QmAbCdEfGhIjKlMnOpQrStUvWxYz1234567890abcdef"
      );
      expect(deepVerify.isValid).to.be.true;
      expect(deepVerify.isMatching).to.be.true;
      expect(deepVerify.tokenOwner).to.equal(student.address);

      // Step 7: Issuer mencabut sertifikat (burn SBT)
      await contractAsIssuer.revokeCertificate("Unhas-2022-00020220001");

      // Step 8: SBT sudah tidak ada di wallet student
      expect(await contract.balanceOf(student.address)).to.equal(0n);

      // Step 9: Verifikasi setelah revoke menunjukkan invalid (struct return)
      const [afterRevokeCert] = await contract.verifyByDocumentId("Unhas-2022-00020220001");
      expect(afterRevokeCert.isValid).to.be.false;
    });
  });
});
