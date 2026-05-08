import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';

/**
 * Service for generating QR Codes containing verification URLs
 * with AES-256-CBC encryption for secure document ID embedding.
 *
 * ENCRYPTION FLOW:
 *   1. documentId (plaintext) → AES-256-CBC encrypt → ciphertext (hex)
 *   2. QR Code URL: https://[domain]/verify?data=[iv]:[ciphertext]
 *
 * DECRYPTION FLOW:
 *   1. Extract iv and ciphertext from URL parameter
 *   2. AES-256-CBC decrypt → documentId (plaintext)
 *   3. Use documentId to query blockchain
 *
 * Reference: Naqiyah et al. - AES-256 encryption for secure data embedding
 */
@Injectable()
export class QrcodeService {
  private readonly logger = new Logger(QrcodeService.name);
  private verificationBaseUrl: string;

  /**
   * AES-256-CBC requires a 32-byte (256-bit) key.
   * The key is derived from the AES_SECRET_KEY environment variable
   * using SHA-256 hashing to ensure exactly 32 bytes.
   */
  private readonly algorithm = 'aes-256-cbc';
  private readonly secretKey: Buffer;

  constructor(private readonly configService: ConfigService) {
    this.verificationBaseUrl =
      this.configService.get<string>('VERIFICATION_BASE_URL') ||
      'http://localhost:3000/verify';

    // Derive a 32-byte key from the secret using SHA-256
    const rawSecret =
      this.configService.get<string>('AES_SECRET_KEY') ||
      'academic-sbt-default-secret-key-2024';

    this.secretKey = crypto.createHash('sha256').update(rawSecret).digest();

    this.logger.log('QrcodeService initialized with AES-256-CBC encryption');
  }

  // ============================================================
  //                   ENCRYPTION / DECRYPTION
  // ============================================================

  /**
   * Encrypt a documentId using AES-256-CBC.
   *
   * Process:
   * 1. Generate a random 16-byte IV (Initialization Vector)
   * 2. Encrypt the documentId using AES-256-CBC with the secret key and IV
   * 3. Return the result as "iv:ciphertext" in hex format
   *
   * @param plaintext The documentId to encrypt
   * @returns Encrypted string in format "iv:ciphertext" (hex encoded)
   */
  encrypt(plaintext: string): string {
    // Generate random 16-byte IV for each encryption (ensures unique ciphertext)
    const iv = crypto.randomBytes(16);

    // Create cipher with AES-256-CBC algorithm
    const cipher = crypto.createCipheriv(this.algorithm, this.secretKey, iv);

    // Encrypt the plaintext
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Combine IV and ciphertext (IV is needed for decryption)
    const result = `${iv.toString('hex')}:${encrypted}`;

    this.logger.debug(
      `Encrypted documentId: ${plaintext} → ${result.substring(0, 40)}...`,
    );

    return result;
  }

  /**
   * Decrypt an AES-256-CBC encrypted string back to the original documentId.
   *
   * Process:
   * 1. Split the "iv:ciphertext" format
   * 2. Decrypt using AES-256-CBC with the same secret key and extracted IV
   * 3. Return the original documentId
   *
   * @param encryptedData Encrypted string in format "iv:ciphertext" (hex encoded)
   * @returns Decrypted documentId (plaintext)
   * @throws Error if decryption fails (invalid key, corrupted data, etc.)
   */
  decrypt(encryptedData: string): string {
    try {
      const [ivHex, encryptedHex] = encryptedData.split(':');

      if (!ivHex || !encryptedHex) {
        throw new Error('Invalid encrypted data format. Expected "iv:ciphertext".');
      }

      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv(this.algorithm, this.secretKey, iv);

      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      this.logger.debug(
        `Decrypted data: ${encryptedData.substring(0, 40)}... → ${decrypted}`,
      );

      return decrypted;
    } catch (error) {
      this.logger.error(`Decryption failed: ${error.message}`);
      throw new Error(
        'Failed to decrypt QR Code data. The data may be corrupted or the encryption key has changed.',
      );
    }
  }

  // ============================================================
  //                   URL BUILDING
  // ============================================================

  /**
   * Build verification URL with AES-256-CBC encrypted documentId.
   *
   * OLD format (plaintext): http://localhost:3000/verify?id=UMI-2022-001
   * NEW format (encrypted): http://localhost:3000/verify?data=a1b2c3...iv...:...ciphertext...
   *
   * @param documentId Unique document ID
   * @returns Complete verification URL with encrypted data parameter
   */
  buildVerificationUrl(documentId: string): string {
    const encryptedData = this.encrypt(documentId);
    const url = `${this.verificationBaseUrl}?data=${encodeURIComponent(encryptedData)}`;

    this.logger.log(
      `Built encrypted verification URL for: ${documentId}`,
    );

    return url;
  }

  // ============================================================
  //                   QR CODE GENERATION
  // ============================================================

  /**
   * Generate QR Code as Data URL (base64 PNG)
   * Suitable for displaying directly in browser as <img src="...">
   *
   * The QR Code contains an AES-256-CBC encrypted verification URL.
   *
   * @param documentId Unique document ID
   * @returns QR Code Data URL (base64 PNG)
   */
  async generateQRCodeDataURL(documentId: string): Promise<string> {
    const url = this.buildVerificationUrl(documentId);
    this.logger.log(
      `Generating encrypted QR Code for: ${documentId}`,
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
