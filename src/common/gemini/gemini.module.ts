import { Global, Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module.js';
import { GeminiService } from './gemini.service.js';

@Global()
@Module({
  imports: [StorageModule],
  providers: [GeminiService],
  exports: [GeminiService],
})
export class GeminiModule {}
