import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinataSDK } from 'pinata';

/**
 * Service untuk mengelola interaksi dengan IPFS melalui Pinata SDK.
 *
 * Tugas utama:
 * 1. Mengunggah file dokumen (PDF) ke IPFS → mendapatkan CID
 * 2. Mengunggah metadata JSON (standar NFT/SBT) ke IPFS → mendapatkan metadata URI
 * 3. Mengambil file dari IPFS menggunakan CID
 */
@Injectable()
export class IpfsService implements OnModuleInit {
  private readonly logger = new Logger(IpfsService.name);
  private pinata: InstanceType<typeof PinataSDK>;
  private gatewayUrl: string;

  constructor(private readonly configService: ConfigService) { }

  onModuleInit() {
    const jwt = this.configService.get<string>('PINATA_JWT');
    const gateway = this.configService.get<string>('PINATA_GATEWAY');

    if (!jwt) {
      this.logger.warn(
        'PINATA_JWT belum dikonfigurasi. IPFS upload tidak akan berfungsi.',
      );
    }

    this.gatewayUrl = gateway || 'gateway.pinata.cloud';

    this.pinata = new PinataSDK({
      pinataJwt: jwt || '',
      pinataGateway: this.gatewayUrl,
    });

    this.logger.log(`Pinata IPFS Service siap (Gateway: ${this.gatewayUrl})`);
  }

  /**
   * Upload file dokumen (PDF/gambar) ke IPFS via Pinata
   * @param file File buffer dari multer
   * @param fileName Nama file asli
   * @returns Object berisi CID dan URL gateway
   */
  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
  ): Promise<{ cid: string; gatewayUrl: string }> {
    try {
      this.logger.log(`Mengupload file ke IPFS: ${fileName}`);

      // Buat File object dari buffer
      const file = new File([new Uint8Array(fileBuffer)], fileName, { type: mimeType });

      // Upload ke Pinata
      const result = await this.pinata.upload.public.file(file);

      const cid = result.cid;
      const url = `https://${this.gatewayUrl}/ipfs/${cid}`;

      this.logger.log(`File berhasil diupload ke IPFS. CID: ${cid}`);

      return {
        cid,
        gatewayUrl: url,
      };
    } catch (error) {
      this.logger.error(`Gagal upload file ke IPFS: ${error.message}`);
      throw error;
    }
  }

  /**
   * Upload metadata JSON (standar NFT/SBT) ke IPFS via Pinata
   *
   * Format metadata mengikuti standar ERC-721 metadata:
   * {
   *   "name": "Ijazah - Budi Santoso",
   *   "description": "Sertifikat akademik S1 Teknik Informatika",
   *   "image": "ipfs://<CID_dokumen>",
   *   "attributes": [ ... ]
   * }
   *
   * @param metadata Object metadata yang akan disimpan
   * @param name Nama untuk file metadata
   * @returns Object berisi CID metadata dan URI (ipfs://...)
   */
  async uploadMetadata(
    metadata: Record<string, unknown>,
    name: string,
  ): Promise<{ cid: string; metadataUri: string; gatewayUrl: string }> {
    try {
      this.logger.log(`Mengupload metadata ke IPFS: ${name}`);

      const result = await this.pinata.upload.public.json(metadata);

      const cid = result.cid;
      const metadataUri = `ipfs://${cid}`;
      const url = `https://${this.gatewayUrl}/ipfs/${cid}`;

      this.logger.log(`Metadata berhasil diupload ke IPFS. CID: ${cid}`);

      return {
        cid,
        metadataUri,
        gatewayUrl: url,
      };
    } catch (error) {
      this.logger.error(`Gagal upload metadata ke IPFS: ${error.message}`);
      throw error;
    }
  }

  /**
   * Mendapatkan URL gateway untuk mengakses file dari IPFS
   * @param cid Content Identifier
   * @returns URL lengkap ke file di gateway
   */
  getGatewayUrl(cid: string): string {
    return `https://${this.gatewayUrl}/ipfs/${cid}`;
  }

  /**
   * Membuat metadata JSON standar ERC-721 untuk SBT akademik
   * @param params Parameter metadata sertifikat
   * @returns Object metadata sesuai standar
   */
  buildCertificateMetadata(params: {
    documentId: string;
    studentName: string;
    studentId: string;
    degree: string;
    major: string;
    issuerName: string;
    documentCid: string;
    issuedAt?: string;
  }): Record<string, unknown> {
    return {
      name: `Sertifikat Akademik - ${params.studentName}`,
      description: `Sertifikat akademik ${params.degree} ${params.major} yang diterbitkan oleh ${params.issuerName}. Document ID: ${params.documentId}`,
      image: `ipfs://${params.documentCid}`,
      external_url: `ipfs://${params.documentCid}`,
      attributes: [
        {
          trait_type: 'Document ID',
          value: params.documentId,
        },
        {
          trait_type: 'Student Name',
          value: params.studentName,
        },
        {
          trait_type: 'Student ID (NIM)',
          value: params.studentId,
        },
        {
          trait_type: 'Degree',
          value: params.degree,
        },
        {
          trait_type: 'Major',
          value: params.major,
        },
        {
          trait_type: 'Issuer',
          value: params.issuerName,
        },
        {
          display_type: 'date',
          trait_type: 'Issued At',
          value: params.issuedAt || new Date().toISOString(),
        },
      ],
    };
  }
}
