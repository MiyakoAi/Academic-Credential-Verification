import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinataSDK } from 'pinata';

/**
 * Service for managing interaction with IPFS through Pinata SDK.
 *
 * Main tasks:
 * 1. Upload document files (PDF) to IPFS → get CID
 * 2. Upload metadata JSON (NFT/SBT standard) to IPFS → get metadata URI
 * 3. Retrieve files from IPFS using CID
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
        'PINATA_JWT is not configured. IPFS upload will not work.',
      );
    }

    this.gatewayUrl = gateway || 'gateway.pinata.cloud';

    this.pinata = new PinataSDK({
      pinataJwt: jwt || '',
      pinataGateway: this.gatewayUrl,
    });

    this.logger.log(`Pinata IPFS Service ready (Gateway: ${this.gatewayUrl})`);
  }

  /**
   * Upload document file (PDF/image) to IPFS via Pinata
   * @param file File buffer from multer
   * @param fileName Original file name
   * @returns Object containing CID and gateway URL
   */
  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
  ): Promise<{ cid: string; gatewayUrl: string }> {
    try {
      this.logger.log(`Uploading file to IPFS: ${fileName}`);

      // Create File object from buffer
      const file = new File([new Uint8Array(fileBuffer)], fileName, { type: mimeType });

      // Upload to Pinata
      const result = await this.pinata.upload.public.file(file);

      const cid = result.cid;
      const url = `https://${this.gatewayUrl}/ipfs/${cid}`;

      this.logger.log(`File successfully uploaded to IPFS. CID: ${cid}`);

      return {
        cid,
        gatewayUrl: url,
      };
    } catch (error) {
      this.logger.error(`Failed to upload file to IPFS: ${error.message}`);
      throw error;
    }
  }

  /**
   * Upload metadata JSON (NFT/SBT standard) to IPFS via Pinata
   *
   * Metadata format follows the ERC-721 metadata standard:
   * {
   *   "name": "Academic Certificate - Student Name",
   *   "description": "Academic certificate S1 Informatics Engineering",
   *   "image": "ipfs://<document_CID>",
   *   "attributes": [ ... ]
   * }
   *
   * @param metadata Metadata object to store
   * @param name Name for the metadata file
   * @returns Object containing metadata CID and URI (ipfs://...)
   */
  async uploadMetadata(
    metadata: Record<string, unknown>,
    name: string,
  ): Promise<{ cid: string; metadataUri: string; gatewayUrl: string }> {
    try {
      this.logger.log(`Uploading metadata to IPFS: ${name}`);

      const result = await this.pinata.upload.public.json(metadata);

      const cid = result.cid;
      const metadataUri = `ipfs://${cid}`;
      const url = `https://${this.gatewayUrl}/ipfs/${cid}`;

      this.logger.log(`Metadata successfully uploaded to IPFS. CID: ${cid}`);

      return {
        cid,
        metadataUri,
        gatewayUrl: url,
      };
    } catch (error) {
      this.logger.error(`Failed to upload metadata to IPFS: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get gateway URL for accessing files from IPFS
   * @param cid Content Identifier
   * @returns Full URL to file on gateway
   */
  getGatewayUrl(cid: string): string {
    return `https://${this.gatewayUrl}/ipfs/${cid}`;
  }

  /**
   * Build standard ERC-721 metadata JSON for academic SBT
   * @param params Certificate metadata parameters
   * @returns Metadata object following the standard
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
      name: `Academic Certificate - ${params.studentName}`,
      description: `Academic certificate ${params.degree} ${params.major} issued by ${params.issuerName}. Document ID: ${params.documentId}`,
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
