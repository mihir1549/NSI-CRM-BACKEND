import { ConfigService } from '@nestjs/config';
import { IEmailService } from './mail-provider.interface.js';
import { MockEmailService } from './mock.provider.js';
import { ResendEmailService } from './resend.provider.js';
import { Logger } from '@nestjs/common';

const logger = new Logger('MailProviderFactory');

/**
 * Factory function that creates the correct email provider
 * based on the MAIL_PROVIDER environment variable.
 *
 * Switching provider = change one ENV variable, zero code changes.
 * To add a new provider: create a new class implementing IEmailService,
 * then add a case here.
 */
export function createMailProvider(
  configService: ConfigService,
): IEmailService {
  const provider = configService.get<string>('MAIL_PROVIDER', 'mock');
  const fromEmail = configService.get<string>('MAIL_FROM', 'noreply@nsi.com');
  const fromName = configService.get<string>('MAIL_FROM_NAME', 'NSI Platform');
  const fromAddress = `${fromName} <${fromEmail}>`;

  switch (provider) {
    case 'resend': {
      const apiKey = configService.get<string>('RESEND_API_KEY');
      if (!apiKey) {
        throw new Error('RESEND_API_KEY is required when MAIL_PROVIDER=resend');
      }
      logger.log('Mail provider: Resend (production)');
      return new ResendEmailService(apiKey, fromAddress);
    }

    case 'mock':
    default:
      logger.log(
        'Mail provider: Mock (development — emails logged to console)',
      );
      return new MockEmailService();
  }
}
