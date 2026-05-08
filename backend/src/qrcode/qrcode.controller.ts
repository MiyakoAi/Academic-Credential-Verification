import { Controller, Get, Param, Query, Res, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { QrcodeService } from './qrcode.service.js';
import type { Response } from 'express';

@ApiTags('qrcode')
@Controller('qrcode')
export class QrcodeController {
  constructor(private readonly qrcodeService: QrcodeService) { }

  /**
   * GET /qrcode/decrypt?data=...
   * Decrypt AES-256-CBC encrypted QR Code data to retrieve the original documentId.
   *
   * This endpoint is called by the frontend when a user scans a QR Code.
   * The QR Code URL contains ?data=<encrypted>, and the frontend sends
   * that encrypted value here to get the original documentId.
   */
  @Get('decrypt')
  @ApiOperation({
    summary: 'Decrypt QR Code data (AES-256-CBC)',
    description:
      'Decrypts the AES-256-CBC encrypted data from a QR Code URL to retrieve the original document ID. ' +
      'This is used when a verifier scans a QR Code containing an encrypted verification URL.',
  })
  @ApiQuery({
    name: 'data',
    description: 'AES-256-CBC encrypted data string from the QR Code URL (format: iv:ciphertext in hex) delete `%3A` and replace it like this ` : `',
    example: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4:e5f6a1b2c3d4e5f6',
  })
  async decryptQRData(@Query('data') encryptedData: string) {
    if (!encryptedData) {
      throw new BadRequestException('Encrypted data parameter is required');
    }

    try {
      const documentId = this.qrcodeService.decrypt(encryptedData);

      return {
        success: true,
        data: {
          documentId,
        },
      };
    } catch (error) {
      throw new BadRequestException(
        error.message || 'Failed to decrypt QR Code data',
      );
    }
  }

  /**
   * GET /qrcode/:documentId
   * Generate QR Code sebagai Data URL (base64) with AES-256-CBC encryption
   */
  @Get(':documentId')
  @ApiOperation({
    summary: 'Generate QR Code (base64 Data URL) with AES-256 encryption',
    description:
      'Generates a QR Code containing an AES-256-CBC encrypted verification URL in base64 Data URL format. ' +
      'The documentId is encrypted before being embedded in the URL.',
  })
  @ApiParam({
    name: 'documentId',
    description: 'Unique document ID',
    example: 'UMI-2022-13020220166',
  })
  async generateQRCode(@Param('documentId') documentId: string) {
    const dataUrl = await this.qrcodeService.generateQRCodeDataURL(documentId);
    const verificationUrl = this.qrcodeService.buildVerificationUrl(documentId);

    return {
      success: true,
      data: {
        documentId,
        verificationUrl,
        qrCodeDataUrl: dataUrl,
      },
    };
  }

  /**
   * GET /qrcode/:documentId/download
   * Download QR Code sebagai file PNG
   */
  @Get(':documentId/download')
  @ApiOperation({
    summary: 'Download QR Code as PNG file',
    description:
      'Generates a PNG QR Code file that can be directly downloaded for printing on physical certificates',
  })
  @ApiParam({
    name: 'documentId',
    description: 'Unique document ID',
    example: 'UMI-2022-13020220166',
  })
  async downloadQRCode(
    @Param('documentId') documentId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.qrcodeService.generateQRCodeBuffer(documentId);

    res.set({
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="qrcode-${documentId}.png"`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  /**
   * GET /qrcode/:documentId/svg
   * Generate QR Code sebagai SVG (kualitas cetak tinggi)
   */
  @Get(':documentId/svg')
  @ApiOperation({
    summary: 'Generate QR Code as SVG',
    description:
      'Generates a QR Code in SVG (vector) format for high-quality printing',
  })
  @ApiParam({
    name: 'documentId',
    description: 'Unique document ID',
    example: 'UMI-2022-13020220166',
  })
  async generateQRCodeSVG(
    @Param('documentId') documentId: string,
    @Res() res: Response,
  ) {
    const svg = await this.qrcodeService.generateQRCodeSVG(documentId);

    res.set({
      'Content-Type': 'image/svg+xml',
      'Content-Disposition': `inline; filename="qrcode-${documentId}.svg"`,
    });

    res.send(svg);
  }
}
