import { Module } from '@nestjs/common';
import { BlockchainService } from './blockchain.service.js';
import { BlockchainController } from './blockchain.controller.js';

@Module({
  controllers: [BlockchainController],
  providers: [BlockchainService],
  exports: [BlockchainService],
})
export class BlockchainModule {}
