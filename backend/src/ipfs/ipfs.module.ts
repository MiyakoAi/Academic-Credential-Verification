import { Module } from '@nestjs/common';
import { IpfsService } from './ipfs.service.js';
import { IpfsController } from './ipfs.controller.js';

@Module({
  controllers: [IpfsController],
  providers: [IpfsService],
  exports: [IpfsService],
})
export class IpfsModule {}
