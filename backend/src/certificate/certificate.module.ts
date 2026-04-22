import { Module } from '@nestjs/common';
import { CertificateService } from './certificate.service.js';
import { CertificateController } from './certificate.controller.js';
import { IpfsModule } from '../ipfs/ipfs.module.js';
import { BlockchainModule } from '../blockchain/blockchain.module.js';
import { QrcodeModule } from '../qrcode/qrcode.module.js';

@Module({
  imports: [IpfsModule, BlockchainModule, QrcodeModule],
  controllers: [CertificateController],
  providers: [CertificateService],
})
export class CertificateModule {}
