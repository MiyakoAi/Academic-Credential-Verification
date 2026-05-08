import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { CertificateService } from './certificate.service.js';
import { RegisterCertificateDto, SecureDownloadDto } from './dto/certificate.dto.js';

@ApiTags('certificates')
@Controller('certificates')
export class CertificateController {
  constructor(private readonly certificateService: CertificateService) { }

  /**
   * POST /certificates/register
   *
   * Process: Admin sends form data + PDF file
   * → Backend upload to IPFS (get a CID)
   * → Backend upload metadata to IPFS (get a metadataURI)
   * → Backend generate QR Code
   * → Return all data to frontend
   * → Frontend calls the smart contract via MetaMask
   */
  @Post('register')
  @ApiOperation({
    summary: 'Prepare certificate registration (Upload to IPFS + Generate QR)',
    description: `
      Main endpoint for the REGISTRATION PHASE.
      
      Process:
      1. Upload PDF document file to IPFS via Pinata → get CID
      2. Create NFT/SBT standard metadata JSON → upload to IPFS → get metadataURI
      3. Generate QR Code with verification URL
      4. Return CID, metadataURI, and QR Code to frontend
      
      After receiving the response, frontend calls registerCertificate() 
      on the smart contract via MetaMask with the returned data.
    `,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: [
        'file',
        'documentId',
        'studentName',
        'studentId',
        'studentWallet',
        'degree',
        'major',
        'issuerName',
      ],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'PDF document file (max 10MB)',
        },
        documentId: {
          type: 'string',
          example: 'UMI-2022-13020220166',
          description: 'Unique document ID',
        },
        studentName: {
          type: 'string',
          example: 'Mugni Adji',
          description: 'Student full name',
        },
        studentId: {
          type: 'string',
          example: '13020220166',
          description: 'Student ID number',
        },
        studentWallet: {
          type: 'string',
          example: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
          description: 'Student wallet address (SBT recipient)',
        },
        degree: {
          type: 'string',
          example: 'S1',
          description: 'Degree level',
        },
        major: {
          type: 'string',
          example: 'Teknik Informatika',
          description: 'Study program',
        },
        issuerName: {
          type: 'string',
          example: 'Universitas Muslim Indonesia',
          description: 'Issuing institution name',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        const allowedMimes = [
          'application/pdf',
          'image/png',
          'image/jpeg',
          'image/jpg',
        ];
        if (allowedMimes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException(
              `Unsupported file format: ${file.mimetype}`,
            ),
            false,
          );
        }
      },
    }),
  )
  async register(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: RegisterCertificateDto,
  ) {
    if (!file) {
      throw new BadRequestException('PDF document file is required');
    }

    const result = await this.certificateService.prepareRegistration(dto, file);

    return {
      success: true,
      message:
        'Document successfully uploaded to IPFS. Please proceed with blockchain registration via MetaMask.',
      data: result,
    };
  }

  /**
   * GET /certificates/verify/:documentId
   *
   * Main endpoint for VERIFICATION PHASE (QR Code scan)
   */
  @Get('verify/:documentId')
  @ApiOperation({
    summary: 'Verify certificate (QR Code Scan)',
    description: `
      Main endpoint when a verifier scans the QR Code on a physical certificate.
      
      Process:
      1. QR Code contains encrypted URL: /verify?data=<AES-256-CBC encrypted documentId>
      2. Frontend decrypts the data via /qrcode/decrypt endpoint
      3. Frontend sends decrypted documentId to this endpoint
      4. Backend queries blockchain + fetches IPFS data
      5. Returns validity status + certificate data
    `,
  })
  @ApiParam({
    name: 'documentId',
    description: 'Unique document ID from QR Code',
    example: 'UMI-2022-13020220166',
  })
  async verify(@Param('documentId') documentId: string) {
    try {
      const result =
        await this.certificateService.verifyCertificate(documentId);

      return {
        success: true,
        message: result.isValid
          ? 'Document is VALID — This certificate is registered and verified on the blockchain'
          : 'Document is INVALID — This certificate has been revoked',
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message:
          'Document NOT FOUND — This document ID is not registered on the blockchain',
        error: error.message,
      };
    }
  }

  /**
   * POST /certificates/download
   *
   * Secure Download: returns IPFS link only if credentials match
   */
  @Post('download')
  @ApiOperation({
    summary: 'Secure download of original certificate PDF',
    description: `
      Requires exact match of Document ID, Student ID (NIM), and Wallet Address
      against the blockchain record. Returns the IPFS gateway URL to download
      the original file only if all three credentials are verified.
    `,
  })
  @ApiConsumes('application/x-www-form-urlencoded')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['documentId', 'studentId', 'studentWallet'],
      properties: {
        documentId: {
          type: 'string',
          example: 'UMI-2022-13020220166',
          description: 'Unique document ID',
        },
        studentId: {
          type: 'string',
          example: '13020220166',
          description: 'Student ID number (NIM)',
        },
        studentWallet: {
          type: 'string',
          example: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
          description: 'Student wallet address',
        },
      },
    },
  })
  async secureDownload(@Body() dto: SecureDownloadDto) {
    try {
      const result = await this.certificateService.secureDownload(
        dto.documentId,
        dto.studentId,
        dto.studentWallet,
      );

      return {
        success: true,
        message: 'Credentials verified — secure download link generated',
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Download authorization failed',
      };
    }
  }

  /**
   * POST /certificates/verify-deep/:documentId
   *
   * Deep verification: upload file to compare CID
   */
  @Post('verify-deep/:documentId')
  @ApiOperation({
    summary: 'Deep verification: upload file to verify authenticity',
    description: `
      Verifier uploads the softcopy document file.
      The system calculates the CID of that file and compares it with the CID on the blockchain.
      If matched → document is authentic. If not matched → document has been modified.
    `,
  })
  @ApiParam({
    name: 'documentId',
    description: 'Unique document ID',
    example: 'UMI-2022-13020220166',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Document file to verify',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async deepVerify(
    @Param('documentId') documentId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Document file is required for verification');
    }

    try {
      const result = await this.certificateService.deepVerify(documentId, file);

      let message: string;
      if (result.isValid && result.isMatching) {
        message =
          'Document is VALID and AUTHENTIC — This file is identical to the document registered on the blockchain';
      } else if (result.isValid && !result.isMatching) {
        message =
          'WARNING — Document is registered but this file DIFFERS from the one stored on the blockchain. It may have been modified!';
      } else {
        message =
          'Document is INVALID — This certificate has been revoked from the blockchain';
      }

      return {
        success: true,
        message,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Document not found on the blockchain',
        error: error.message,
      };
    }
  }
}
