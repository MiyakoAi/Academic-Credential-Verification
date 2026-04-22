import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { QrcodeService } from './qrcode.service.js';
import type { Response } from 'express';

@ApiTags('qrcode')
@Controller('qrcode')
export class QrcodeController {
  constructor(private readonly qrcodeService: QrcodeService) {}

  /**
   * GET /qrcode/:documentId
   * Generate QR Code sebagai Data URL (base64)
   */
  @Get(':documentId')
  @ApiOperation({
    summary: 'Generate QR Code (base64 Data URL)',
    description:
      'Menghasilkan QR Code berisi URL verifikasi dalam format base64 Data URL. Cocok untuk ditampilkan di browser.',
  })
  @ApiParam({
    name: 'documentId',
    description: 'ID unik dokumen',
    example: 'UGM-2024-00001',
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
    summary: 'Download QR Code sebagai file PNG',
    description:
      'Menghasilkan file PNG QR Code yang bisa langsung diunduh untuk dicetak pada ijazah fisik',
  })
  @ApiParam({
    name: 'documentId',
    description: 'ID unik dokumen',
    example: 'UGM-2024-00001',
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
    summary: 'Generate QR Code sebagai SVG',
    description:
      'Menghasilkan QR Code dalam format SVG (vektor) untuk kualitas cetak tinggi',
  })
  @ApiParam({
    name: 'documentId',
    description: 'ID unik dokumen',
    example: 'UGM-2024-00001',
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
