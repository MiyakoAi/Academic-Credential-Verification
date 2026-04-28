import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { IpfsService } from './ipfs.service.js';

@ApiTags('ipfs')
@Controller('ipfs')
export class IpfsController {
  constructor(private readonly ipfsService: IpfsService) {}

  /**
   * Endpoint for uploading document files to IPFS
   * POST /ipfs/upload
   */
  @Post('upload')
  @ApiOperation({
    summary: 'Upload document file to IPFS',
    description:
      'Upload file (PDF/image) to IPFS via Pinata and return the CID',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Document file (PDF, max 10MB)',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // Max 10MB
      },
      fileFilter: (_req, file, callback) => {
        // Only allow PDF and images
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
              `Unsupported file format: ${file.mimetype}. Use PDF, PNG, or JPG.`,
            ),
            false,
          );
        }
      },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File not found in the request');
    }

    const result = await this.ipfsService.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
    );

    return {
      success: true,
      message: 'File successfully uploaded to IPFS',
      data: {
        cid: result.cid,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        gatewayUrl: result.gatewayUrl,
      },
    };
  }
}
