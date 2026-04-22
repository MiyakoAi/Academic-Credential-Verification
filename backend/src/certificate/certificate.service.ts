import { Injectable, Logger } from '@nestjs/common';
import { IpfsService } from '../ipfs/ipfs.service.js';
import { BlockchainService } from '../blockchain/blockchain.service.js';
import { QrcodeService } from '../qrcode/qrcode.service.js';
import { RegisterCertificateDto } from './dto/certificate.dto.js';

/**
 * Service utama yang mengorkestrasi seluruh alur registrasi dan verifikasi sertifikat.
 *
 * ALUR REGISTRASI (POST /certificates/register):
 * 1. Admin upload file PDF → Backend upload ke IPFS via Pinata → dapat CID
 * 2. Backend membuat metadata JSON (standar NFT) → upload ke IPFS → dapat metadataURI
 * 3. Backend mengembalikan CID + metadataURI ke frontend
 * 4. Frontend memanggil smart contract registerCertificate() via MetaMask (transaksi blockchain)
 * 5. Setelah transaksi berhasil, frontend request QR Code ke backend
 *
 * ALUR VERIFIKASI (GET /certificates/verify/:documentId):
 * 1. Verifier scan QR Code → buka URL
 * 2. Backend query blockchain via verifyByDocumentId()
 * 3. Backend ambil file dari IPFS gateway
 * 4. Backend return data lengkap + status validitas ke frontend
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
   * FASE REGISTRASI - STEP 1: Upload dokumen ke IPFS dan siapkan data untuk blockchain
   *
   * Proses:
   * 1. Upload file PDF ke IPFS → dapat CID
   * 2. Buat metadata JSON standar ERC-721 → upload ke IPFS → dapat metadataURI
   * 3. Return CID + metadataURI ke frontend
   * 4. Frontend lanjut memanggil smart contract via MetaMask
   *
   * @param dto Data sertifikat dari form admin
   * @param file File dokumen PDF
   * @returns CID, metadataURI, dan QR Code data
   */
  async prepareRegistration(
    dto: RegisterCertificateDto,
    file: Express.Multer.File,
  ) {
    this.logger.log(
      `Memulai persiapan registrasi sertifikat: ${dto.documentId}`,
    );

    // Step 1: Upload file dokumen ke IPFS
    this.logger.log(`Step 1: Upload dokumen ke IPFS...`);
    const documentUpload = await this.ipfsService.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
    );

    // Step 2: Buat metadata JSON dan upload ke IPFS
    this.logger.log(`Step 2: Upload metadata ke IPFS...`);
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
      `Persiapan registrasi selesai untuk: ${dto.documentId}`,
    );

    return {
      // Data untuk frontend memanggil smart contract
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
   * FASE VERIFIKASI - Verifikasi sertifikat dari QR Code scan
   *
   * Proses:
   * 1. Ambil data dari blockchain berdasarkan documentId
   * 2. Buat URL gateway untuk mengambil file dari IPFS
   * 3. Return data lengkap + status ke frontend
   *
   * @param documentId ID dokumen dari QR Code
   */
  async verifyCertificate(documentId: string) {
    this.logger.log(`Memulai verifikasi sertifikat: ${documentId}`);

    // Step 1: Query blockchain
    const blockchainData =
      await this.blockchainService.verifyByDocumentId(documentId);

    // Step 2: Buat URL gateway IPFS untuk file asli
    const documentUrl = this.ipfsService.getGatewayUrl(
      blockchainData.certificate.ipfsCID,
    );

    // Step 3: Generate QR code (untuk ditampilkan di halaman verifikasi)
    const qrCodeDataUrl =
      await this.qrcodeService.generateQRCodeDataURL(documentId);

    this.logger.log(
      `Verifikasi selesai: ${documentId} → ${blockchainData.isValid ? 'VALID' : 'TIDAK VALID'}`,
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
   * DEEP VERIFICATION - Verifikasi dengan membandingkan CID
   *
   * @param documentId ID dokumen
   * @param file File yang di-upload untuk dibandingkan
   */
  async deepVerify(documentId: string, file: Express.Multer.File) {
    this.logger.log(`Memulai deep verification: ${documentId}`);

    // Step 1: Upload file ke IPFS untuk mendapatkan CID-nya
    const uploadResult = await this.ipfsService.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
    );

    // Step 2: Bandingkan CID dengan blockchain
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
