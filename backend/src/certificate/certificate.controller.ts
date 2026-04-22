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
import { RegisterCertificateDto } from './dto/certificate.dto.js';

@ApiTags('certificates')
@Controller('certificates')
export class CertificateController {
  constructor(private readonly certificateService: CertificateService) { }

  /**
   * POST /certificates/register
   *
   * Alur: Admin mengirim form data + file PDF
   * → Backend upload ke IPFS (dapat CID)
   * → Backend upload metadata ke IPFS (dapat metadataURI)
   * → Backend generate QR Code
   * → Return semua data ke frontend
   * → Frontend memanggil smart contract via MetaMask
   */
  @Post('register')
  @ApiOperation({
    summary: 'Persiapan registrasi sertifikat (Upload ke IPFS + Generate QR)',
    description: `
      Endpoint utama untuk FASE REGISTRASI.
      
      Proses:
      1. Upload file dokumen PDF ke IPFS via Pinata → dapat CID
      2. Buat metadata JSON standar NFT/SBT → upload ke IPFS → dapat metadataURI
      3. Generate QR Code berisi URL verifikasi
      4. Return CID, metadataURI, dan QR Code ke frontend
      
      Setelah mendapat response, frontend memanggil registerCertificate() 
      pada smart contract melalui MetaMask dengan data yang dikembalikan.
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
          description: 'File dokumen PDF (maks 10MB)',
        },
        documentId: {
          type: 'string',
          example: 'UMI-2022-13020220166',
          description: 'ID unik dokumen',
        },
        studentName: {
          type: 'string',
          example: 'Mugni Adji',
          description: 'Nama lengkap mahasiswa',
        },
        studentId: {
          type: 'string',
          example: '13020220166',
          description: 'NIM mahasiswa',
        },
        studentWallet: {
          type: 'string',
          example: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
          description: 'Alamat wallet mahasiswa (penerima SBT)',
        },
        degree: {
          type: 'string',
          example: 'S1',
          description: 'Gelar/jenjang',
        },
        major: {
          type: 'string',
          example: 'Teknik Informatika',
          description: 'Program studi',
        },
        issuerName: {
          type: 'string',
          example: 'Universitas Muslim Indonesia',
          description: 'Nama institusi penerbit',
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
              `Format file tidak didukung: ${file.mimetype}`,
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
      throw new BadRequestException('File dokumen PDF wajib diupload');
    }

    const result = await this.certificateService.prepareRegistration(dto, file);

    return {
      success: true,
      message:
        'Dokumen berhasil diupload ke IPFS. Silakan lanjutkan registrasi ke blockchain melalui MetaMask.',
      data: result,
    };
  }

  /**
   * GET /certificates/verify/:documentId
   *
   * Endpoint utama untuk FASE VERIFIKASI (QR Code scan)
   */
  @Get('verify/:documentId')
  @ApiOperation({
    summary: 'Verifikasi sertifikat (QR Code Scan)',
    description: `
      Endpoint utama saat verifier melakukan scan QR Code pada ijazah fisik.
      
      Proses:
      1. QR Code berisi URL: /verify?id=documentId
      2. Frontend kirim request ke endpoint ini
      3. Backend query blockchain + ambil data IPFS
      4. Return status validitas + data sertifikat
    `,
  })
  @ApiParam({
    name: 'documentId',
    description: 'ID unik dokumen dari QR Code',
    example: 'UMI-2022-13020220166',
  })
  async verify(@Param('documentId') documentId: string) {
    try {
      const result =
        await this.certificateService.verifyCertificate(documentId);

      return {
        success: true,
        message: result.isValid
          ? 'Dokumen VALID — Sertifikat ini terdaftar dan terverifikasi di blockchain'
          : 'Dokumen TIDAK VALID — Sertifikat ini telah dicabut',
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message:
          'Dokumen TIDAK DITEMUKAN — ID dokumen ini tidak terdaftar di blockchain',
        error: error.message,
      };
    }
  }

  /**
   * POST /certificates/verify-deep/:documentId
   *
   * Deep verification: upload file untuk membandingkan CID
   */
  @Post('verify-deep/:documentId')
  @ApiOperation({
    summary: 'Deep verification: upload file untuk verifikasi keaslian',
    description: `
      Verifikator mengupload file softcopy dokumen.
      Sistem menghitung CID file tersebut dan membandingkan dengan CID di blockchain.
      Jika cocok → dokumen asli. Jika tidak cocok → dokumen telah dimodifikasi.
    `,
  })
  @ApiParam({
    name: 'documentId',
    description: 'ID unik dokumen',
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
          description: 'File dokumen untuk diverifikasi',
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
      throw new BadRequestException('File dokumen wajib diupload untuk verifikasi');
    }

    try {
      const result = await this.certificateService.deepVerify(documentId, file);

      let message: string;
      if (result.isValid && result.isMatching) {
        message =
          'Dokumen VALID dan ASLI — File ini identik dengan dokumen yang terdaftar di blockchain';
      } else if (result.isValid && !result.isMatching) {
        message =
          'PERHATIAN — Dokumen terdaftar tapi file ini BERBEDA dengan yang tersimpan di blockchain. Kemungkinan telah dimodifikasi!';
      } else {
        message =
          'Dokumen TIDAK VALID — Sertifikat ini telah dicabut dari blockchain';
      }

      return {
        success: true,
        message,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Dokumen tidak ditemukan di blockchain',
        error: error.message,
      };
    }
  }
}
