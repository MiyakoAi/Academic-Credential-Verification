import { Injectable, Logger } from '@nestjs/common';
import { IpfsService } from '../ipfs/ipfs.service.js';
import { BlockchainService } from '../blockchain/blockchain.service.js';
import { QrcodeService } from '../qrcode/qrcode.service.js';
import { RegisterCertificateDto } from './dto/certificate.dto.js';

/**
 * Main service that orchestrates the entire certificate registration and verification flow.
 *
 * REGISTRATION FLOW (POST /certificates/register):
 * 1. Admin uploads PDF file → Backend uploads to IPFS via Pinata → gets CID
 * 2. Backend creates metadata JSON (NFT standard) → uploads to IPFS → gets metadataURI
 * 3. Backend returns CID + metadataURI to frontend
 * 4. Frontend calls smart contract registerCertificate() via MetaMask (blockchain transaction)
 * 5. After successful transaction, frontend requests QR Code from backend
 *
 * VERIFICATION FLOW (GET /certificates/verify/:documentId):
 * 1. Verifier scans QR Code → opens URL
 * 2. Backend queries blockchain via verifyByDocumentId()
 * 3. Backend fetches file from IPFS gateway
 * 4. Backend returns complete data + validity status to frontend
 */
@Injectable()
export class CertificateService {
  private readonly logger = new Logger(CertificateService.name);

  constructor(
    private readonly ipfsService: IpfsService,
    private readonly blockchainService: BlockchainService,
    private readonly qrcodeService: QrcodeService,
  ) { }

  /**
   * REGISTRATION PHASE - STEP 1: Upload document to IPFS and prepare data for blockchain
   *
   * Process:
   * 1. Upload PDF file to IPFS → get CID
   * 2. Create ERC-721 standard metadata JSON → upload to IPFS → get metadataURI
   * 3. Return CID + metadataURI to frontend
   * 4. Frontend continues by calling smart contract via MetaMask
   *
   * @param dto Certificate data from admin form
   * @param file PDF document file
   * @returns CID, metadataURI, and QR Code data
   */
  async prepareRegistration(
    dto: RegisterCertificateDto,
    file: Express.Multer.File,
  ) {
    this.logger.log(
      `Starting registration preparation for certificate: ${dto.documentId}`,
    );

    // Step 1: Upload document file to IPFS
    this.logger.log(`Step 1: Uploading document to IPFS...`);
    const documentUpload = await this.ipfsService.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
    );

    // Step 2: Create metadata JSON and upload to IPFS
    this.logger.log(`Step 2: Uploading metadata to IPFS...`);
    const metadata = this.ipfsService.buildCertificateMetadata({
      documentId: dto.documentId,
      studentName: dto.studentName,
      studentId: dto.studentId,
      degree: dto.degree,
      major: dto.major,
      issuerName: dto.issuerName,
      documentCid: documentUpload.cid,
    });

    const metadataUpload = await this.ipfsService.uploadMetadata(
      metadata,
      `metadata-${dto.documentId}`,
    );

    // Step 3: Generate QR Code
    this.logger.log(`Step 3: Generate QR Code...`);
    const qrCodeDataUrl =
      await this.qrcodeService.generateQRCodeDataURL(dto.documentId);
    const verificationUrl =
      this.qrcodeService.buildVerificationUrl(dto.documentId);

    this.logger.log(
      `Registration preparation complete for: ${dto.documentId}`,
    );

    return {
      // Data for frontend to call smart contract
      documentId: dto.documentId,
      ipfsCID: documentUpload.cid,
      studentName: dto.studentName,
      studentId: dto.studentId,
      studentWallet: dto.studentWallet,
      degree: dto.degree,
      major: dto.major,
      metadataURI: metadataUpload.metadataUri,

      // URL file di IPFS
      documentGatewayUrl: documentUpload.gatewayUrl,
      metadataGatewayUrl: metadataUpload.gatewayUrl,

      // QR Code
      qrCode: {
        dataUrl: qrCodeDataUrl,
        verificationUrl,
      },
    };
  }

  /**
   * VERIFICATION PHASE - Verify certificate from QR Code scan
   *
   * Process:
   * 1. Get data from blockchain by documentId
   * 2. Create gateway URL to fetch file from IPFS
   * 3. Return complete data + status to frontend
   *
   * @param documentId Document ID from QR Code
   */
  async verifyCertificate(documentId: string) {
    this.logger.log(`Starting certificate verification: ${documentId}`);

    // Step 1: Query blockchain
    const blockchainData =
      await this.blockchainService.verifyByDocumentId(documentId);

    // Step 2: Create IPFS gateway URL for the original file
    const documentUrl = this.ipfsService.getGatewayUrl(
      blockchainData.certificate.ipfsCID,
    );

    // Step 3: Generate QR code (to display on verification page)
    const qrCodeDataUrl =
      await this.qrcodeService.generateQRCodeDataURL(documentId);

    this.logger.log(
      `Verification complete: ${documentId} → ${blockchainData.isValid ? 'VALID' : 'INVALID'}`,
    );

    return {
      isValid: blockchainData.isValid,
      certificate: blockchainData.certificate,
      tokenId: blockchainData.tokenId,
      documentUrl,
      qrCode: qrCodeDataUrl,
    };
  }

  /**
   * DEEP VERIFICATION - Verify by comparing CID
   *
   * @param documentId Document ID
   * @param file File uploaded for comparison
   */
  async deepVerify(documentId: string, file: Express.Multer.File) {
    this.logger.log(`Starting deep verification: ${documentId}`);

    // Step 1: Upload file to IPFS to get its CID
    const uploadResult = await this.ipfsService.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
    );

    // Step 2: Compare CID with blockchain
    const verifyResult = await this.blockchainService.verifyCertificateWithCID(
      documentId,
      uploadResult.cid,
    );

    this.logger.log(
      `Deep verify selesai: ${documentId} → Valid: ${verifyResult.isValid}, Match: ${verifyResult.isMatching}`,
    );

    return {
      isValid: verifyResult.isValid,
      isMatching: verifyResult.isMatching,
      uploadedCID: uploadResult.cid,
      storedCID: verifyResult.certificate.ipfsCID,
      certificate: verifyResult.certificate,
      tokenId: verifyResult.tokenId,
      tokenOwner: verifyResult.tokenOwner,
    };
  }
}
