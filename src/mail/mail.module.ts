import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service.js';
import { EMAIL_SERVICE_TOKEN } from './providers/mail-provider.interface.js';
import { createMailProvider } from './providers/mail-provider.factory.js';

@Module({
  providers: [
    {
      provide: EMAIL_SERVICE_TOKEN,
      useFactory: (configService: ConfigService) =>
        createMailProvider(configService),
      inject: [ConfigService],
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
