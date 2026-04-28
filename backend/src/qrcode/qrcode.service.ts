import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';

/**
 * Service for generating QR Codes containing verification URLs.
 *
 * QR Code contains URL: https://[domain]/verify?id=[documentId]
 * When scanned, this URL directs the verifier to a verification page
 * that automatically fetches data from the blockchain.
 */
@Injectable()
export class QrcodeService {
  private readonly logger = new Logger(QrcodeService.name);
  private verificationBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.verificationBaseUrl =
      this.configService.get<string>('VERIFICATION_BASE_URL') ||
      'http://localhost:3000/verify';
  }

  /**
   * Build verification URL from documentId
   * @param documentId Unique document ID
   * @returns Complete verification URL
   */
  buildVerificationUrl(documentId: string): string {
    return `${this.verificationBaseUrl}?id=${encodeURIComponent(documentId)}`;
  }

  /**
   * Generate QR Code as Data URL (base64 PNG)
   * Suitable for displaying directly in browser as <img src="...">
   *
   * @param documentId Unique document ID
   * @returns QR Code Data URL (base64 PNG)
   */
  async generateQRCodeDataURL(documentId: string): Promise<string> {
    const url = this.buildVerificationUrl(documentId);
    this.logger.log(
      `Generating QR Code for: ${documentId} → ${url}`,
    );

    const dataUrl = await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'H', // High error correction (30%)
      type: 'image/png',
      margin: 2,
      width: 400,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    return dataUrl;
  }

  /**
   * Generate QR Code as Buffer (PNG)
   * Suitable for downloading as a PNG file
   *
   * @param documentId Unique document ID
   * @returns QR Code PNG image Buffer
   */
  async generateQRCodeBuffer(documentId: string): Promise<Buffer> {
    const url = this.buildVerificationUrl(documentId);

    const buffer = await QRCode.toBuffer(url, {
      errorCorrectionLevel: 'H',
      type: 'png',
      margin: 2,
      width: 400,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    return buffer;
  }

  /**
   * Generate QR Code as SVG string
   * Suitable for high-quality printing (vector, no pixelation)
   *
   * @param documentId Unique document ID
   * @returns QR Code SVG string
   */
  async generateQRCodeSVG(documentId: string): Promise<string> {
    const url = this.buildVerificationUrl(documentId);

    const svg = await QRCode.toString(url, {
      errorCorrectionLevel: 'H',
      type: 'svg',
      margin: 2,
      width: 400,
    });

    return svg;
  }
}
