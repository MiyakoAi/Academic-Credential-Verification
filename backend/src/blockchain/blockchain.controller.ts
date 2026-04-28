import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { BlockchainService } from './blockchain.service.js';

@ApiTags('blockchain')
@Controller('blockchain')
export class BlockchainController {
  constructor(private readonly blockchainService: BlockchainService) { }

  /**
   * GET /blockchain/contract-info
   * Get ABI and contract address for frontend
   */
  @Get('contract-info')
  @ApiOperation({
    summary: 'Get smart contract info (ABI + Address)',
    description:
      'Frontend requires ABI and address to interact directly with the smart contract via MetaMask',
  })
  getContractInfo() {
    return {
      success: true,
      data: this.blockchainService.getContractInfo(),
    };
  }

  /**
   * GET /blockchain/verify/:documentId
   * Verify certificate by documentId (from QR Code scan)
   */
  @Get('verify/:documentId')
  @ApiOperation({
    summary: 'Verify certificate by Document ID',
    description:
      'Main endpoint for verification when scanning QR Code. Calls verifyByDocumentId() on the smart contract (free, no gas fee)',
  })
  @ApiParam({
    name: 'documentId',
    description: 'Unique document ID (e.g.: UMI-2022-13020220166)',
    example: 'UMI-2022-13020220166',
  })
  async verifyByDocumentId(@Param('documentId') documentId: string) {
    try {
      const result =
        await this.blockchainService.verifyByDocumentId(documentId);

      return {
        success: true,
        message: result.isValid
          ? 'Document is VALID and registered on the blockchain'
          : 'Document is INVALID (has been revoked)',
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

  /**
   * GET /blockchain/verify-deep/:documentId?cid=xxx
   * Deep verification: bandingkan CID
   */
  @Get('verify-deep/:documentId')
  @ApiOperation({
    summary: 'Deep verification: compare document CID',
    description:
      'Compare the uploaded file CID with the CID stored on the blockchain. Useful for ensuring a digital document has not been modified.',
  })
  @ApiParam({
    name: 'documentId',
    description: 'Unique document ID',
    example: 'UMI-2022-13020220166',
  })
  @ApiQuery({
    name: 'cid',
    description: 'CID of the file to verify',
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
        message = 'Document is VALID and AUTHENTIC (CID matches blockchain)';
      } else if (result.isValid && !result.isMatching) {
        message =
          'Document is registered but CID DOES NOT MATCH — the file may have been modified';
      } else {
        message = 'Document is INVALID (has been revoked)';
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

  /**
   * GET /blockchain/certificate/:documentId
   * Get complete certificate data
   */
  @Get('certificate/:documentId')
  @ApiOperation({
    summary: 'Get complete certificate data from blockchain',
  })
  @ApiParam({
    name: 'documentId',
    description: 'Unique document ID',
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
        message: 'Document not found',
        error: error.message,
      };
    }
  }

  /**
   * GET /blockchain/stats
   * Total certificate statistics
   */
  @Get('stats')
  @ApiOperation({
    summary: 'Get certificate statistics',
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
