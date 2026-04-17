import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import type { IVideoProvider } from './video-provider.interface.js';
import { MockVideoProvider } from './mock-video.provider.js';
import { BunnyVideoProvider } from './bunny-video.provider.js';

const logger = new Logger('VideoProviderFactory');

export function createVideoProvider(
  configService: ConfigService,
): IVideoProvider {
  const provider = configService.get<string>('VIDEO_PROVIDER', 'mock');

  switch (provider) {
    case 'bunny': {
      const libraryId = configService.get<string>('BUNNY_LIBRARY_ID');
      const apiKey = configService.get<string>('BUNNY_API_KEY');
      const cdnHostname = configService.get<string>('BUNNY_CDN_HOSTNAME');
      const tokenKey = configService.get<string>('BUNNY_TOKEN_KEY');

      if (!libraryId || !apiKey || !cdnHostname || !tokenKey) {
        throw new Error(
          'BUNNY_LIBRARY_ID, BUNNY_API_KEY, BUNNY_CDN_HOSTNAME, and BUNNY_TOKEN_KEY ' +
            'are required when VIDEO_PROVIDER=bunny',
        );
      }

      logger.log('Video provider: Bunny.net (production)');
      return new BunnyVideoProvider(libraryId, apiKey, cdnHostname, tokenKey);
    }

    case 'mock':
    default:
      logger.log('Video provider: Mock (development — no real HTTP calls)');
      return new MockVideoProvider();
  }
}
