import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';

/**
 * Service untuk membuat QR Code berisi URL verifikasi.
 *
 * QR Code berisi URL: https://[domain]/verify?id=[documentId]
 * Ketika di-scan, URL ini mengarahkan verifier ke halaman verifikasi
 * yang secara otomatis mengambil data dari blockchain.
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
   * Membuat URL verifikasi dari documentId
   * @param documentId ID unik dokumen
   * @returns URL verifikasi lengkap
   */
  buildVerificationUrl(documentId: string): string {
    return `${this.verificationBaseUrl}?id=${encodeURIComponent(documentId)}`;
  }

  /**
   * Membuat QR Code dalam format Data URL (base64 PNG)
   * Cocok untuk ditampilkan langsung di browser sebagai <img src="...">
   *
   * @param documentId ID unik dokumen
   * @returns Data URL QR Code (base64 PNG)
   */
  async generateQRCodeDataURL(documentId: string): Promise<string> {
    const url = this.buildVerificationUrl(documentId);
    this.logger.log(
      `Generating QR Code untuk: ${documentId} → ${url}`,
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
   * Membuat QR Code dalam format Buffer (PNG)
   * Cocok untuk di-download sebagai file PNG
   *
   * @param documentId ID unik dokumen
   * @returns Buffer gambar QR Code PNG
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
   * Membuat QR Code dalam format SVG string
   * Cocok untuk quality cetak tinggi (vektor, tidak pecah)
   *
   * @param documentId ID unik dokumen
   * @returns SVG string QR Code
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
