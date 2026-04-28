import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { QrcodeService } from './qrcode.service.js';
import type { Response } from 'express';

@ApiTags('qrcode')
@Controller('qrcode')
export class QrcodeController {
  constructor(private readonly qrcodeService: QrcodeService) { }

  /**
   * GET /qrcode/:documentId
   * Generate QR Code sebagai Data URL (base64)
   */
  @Get(':documentId')
  @ApiOperation({
    summary: 'Generate QR Code (base64 Data URL)',
    description:
      'Generates a QR Code containing a verification URL in base64 Data URL format. Suitable for displaying in browser.',
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
