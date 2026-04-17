import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VIDEO_PROVIDER_TOKEN } from './video-provider.interface.js';
import { createVideoProvider } from './video-provider.factory.js';

/**
 * VideoModule — provides IVideoProvider under VIDEO_PROVIDER_TOKEN.
 * Import this module wherever IVideoProvider injection is needed.
 */
@Module({
  providers: [
    {
      provide: VIDEO_PROVIDER_TOKEN,
      useFactory: (configService: ConfigService) =>
        createVideoProvider(configService),
      inject: [ConfigService],
    },
  ],
  exports: [VIDEO_PROVIDER_TOKEN],
})
export class VideoModule {}
