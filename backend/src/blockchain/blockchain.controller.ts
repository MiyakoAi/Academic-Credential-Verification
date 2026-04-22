import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { BlockchainService } from './blockchain.service.js';

@ApiTags('blockchain')
@Controller('blockchain')
export class BlockchainController {
  constructor(private readonly blockchainService: BlockchainService) { }

  /**
   * GET /blockchain/contract-info
   * Mendapatkan ABI dan address contract untuk frontend
   */
  @Get('contract-info')
  @ApiOperation({
    summary: 'Mendapatkan info smart contract (ABI + Address)',
    description:
      'Frontend memerlukan ABI dan address untuk berinteraksi langsung dengan smart contract via MetaMask',
  })
  getContractInfo() {
    return {
      success: true,
      data: this.blockchainService.getContractInfo(),
    };
  }

  /**
   * GET /blockchain/verify/:documentId
   * Verifikasi sertifikat berdasarkan documentId (dari QR Code scan)
   */
  @Get('verify/:documentId')
  @ApiOperation({
    summary: 'Verifikasi sertifikat berdasarkan Document ID',
    description:
      'Endpoint utama untuk verifikasi saat scan QR Code. Memanggil verifyByDocumentId() pada smart contract (gratis, tanpa gas fee)',
  })
  @ApiParam({
    name: 'documentId',
    description: 'ID unik dokumen (contoh: UMI-2022-13020220166)',
    example: 'UMI-2022-13020220166',
  })
  async verifyByDocumentId(@Param('documentId') documentId: string) {
    try {
      const result =
        await this.blockchainService.verifyByDocumentId(documentId);

      return {
        success: true,
        message: result.isValid
          ? 'Dokumen VALID dan terdaftar di blockchain'
          : 'Dokumen TIDAK VALID (telah dicabut)',
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

  /**
   * GET /blockchain/verify-deep/:documentId?cid=xxx
   * Deep verification: bandingkan CID
   */
  @Get('verify-deep/:documentId')
  @ApiOperation({
    summary: 'Deep verification: bandingkan CID dokumen',
    description:
      'Membandingkan CID file yang di-upload dengan CID yang tersimpan di blockchain. Berguna untuk memastikan dokumen digital tidak dimodifikasi.',
  })
  @ApiParam({
    name: 'documentId',
    description: 'ID unik dokumen',
    example: 'UMI-2022-13020220166',
  })
  @ApiQuery({
    name: 'cid',
    description: 'CID dari file yang ingin diverifikasi',
    example: 'QmX7b3e1LpHTzKsRoEaqbzCp5AuNpBSmk5pCiN4QiPzMar',
  })
  async verifyDeep(
    @Param('documentId') documentId: string,
    @Query('cid') cid: string,
  ) {
    try {
      const result = await this.blockchainService.verifyCertificateWithCID(
        documentId,
        cid,
      );

      let message: string;
      if (result.isValid && result.isMatching) {
        message = 'Dokumen VALID dan ASLI (CID cocok dengan blockchain)';
      } else if (result.isValid && !result.isMatching) {
        message =
          'Dokumen terdaftar tapi CID TIDAK COCOK — kemungkinan file telah dimodifikasi';
      } else {
        message = 'Dokumen TIDAK VALID (telah dicabut)';
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

  /**
   * GET /blockchain/certificate/:documentId
   * Mengambil data sertifikat lengkap
   */
  @Get('certificate/:documentId')
  @ApiOperation({
    summary: 'Mengambil data sertifikat lengkap dari blockchain',
  })
  @ApiParam({
    name: 'documentId',
    description: 'ID unik dokumen',
    example: 'UMI-2022-13020220166',
  })
  async getCertificate(@Param('documentId') documentId: string) {
    try {
      const result = await this.blockchainService.getCertificate(documentId);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Dokumen tidak ditemukan',
        error: error.message,
      };
    }
  }

  /**
   * GET /blockchain/stats
   * Statistik total sertifikat
   */
  @Get('stats')
  @ApiOperation({
    summary: 'Mendapatkan statistik sertifikat',
  })
  async getStats() {
    try {
      const total = await this.blockchainService.getTotalCertificates();
      return {
        success: true,
        data: { totalCertificates: total },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
