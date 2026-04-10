import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CloudflareR2StorageProvider } from './cloudinary.provider.js';
import { LocalStorageProvider } from './local.provider.js';
import { STORAGE_PROVIDER } from './storage-provider.interface.js';

@Module({
  imports: [ConfigModule],
  providers: [
    LocalStorageProvider,
    {
      provide: STORAGE_PROVIDER,
      useFactory: (configService: ConfigService) => {
        const provider = configService.get<string>('STORAGE_PROVIDER', 'local');

        if (provider === 'r2') {
          return new CloudflareR2StorageProvider(configService);
        } else {
          return new LocalStorageProvider();
        }
      },
      inject: [ConfigService],
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
