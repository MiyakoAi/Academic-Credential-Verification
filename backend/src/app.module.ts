import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IpfsModule } from './ipfs/ipfs.module.js';
import { BlockchainModule } from './blockchain/blockchain.module.js';
import { CertificateModule } from './certificate/certificate.module.js';
import { QrcodeModule } from './qrcode/qrcode.module.js';

@Module({
  imports: [
    // Konfigurasi environment variables
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Module-module aplikasi
    IpfsModule,
    BlockchainModule,
    CertificateModule,
    QrcodeModule,
  ],
})
export class AppModule {}
