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
   * Endpoint untuk upload file dokumen ke IPFS
   * POST /ipfs/upload
   */
  @Post('upload')
  @ApiOperation({
    summary: 'Upload file dokumen ke IPFS',
    description:
      'Mengupload file (PDF/gambar) ke IPFS melalui Pinata dan mengembalikan CID',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File dokumen (PDF, maks 10MB)',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // Maks 10MB
      },
      fileFilter: (_req, file, callback) => {
        // Hanya izinkan PDF dan gambar
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
              `Format file tidak didukung: ${file.mimetype}. Gunakan PDF, PNG, atau JPG.`,
            ),
            false,
          );
        }
      },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File tidak ditemukan dalam request');
    }

    const result = await this.ipfsService.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
    );

    return {
      success: true,
      message: 'File berhasil diupload ke IPFS',
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
