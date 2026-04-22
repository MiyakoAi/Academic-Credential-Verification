import { Module } from '@nestjs/common';
import { QrcodeService } from './qrcode.service.js';
import { QrcodeController } from './qrcode.controller.js';

@Module({
  controllers: [QrcodeController],
  providers: [QrcodeService],
  exports: [QrcodeService],
})
export class QrcodeModule {}
