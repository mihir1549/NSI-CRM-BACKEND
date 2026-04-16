import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import type { PhoneProvider } from './providers/phone-provider.interface.js';
import { MockPhoneProvider } from './providers/mock-phone.provider.js';
import { TwilioPhoneProvider } from './providers/twilio-phone.provider.js';

const logger = new Logger('PhoneProviderFactory');

export function createPhoneProvider(
  configService: ConfigService,
): PhoneProvider {
  const provider = configService.get<string>('SMS_PROVIDER', 'mock');

  switch (provider) {
    case 'twilio': {
      const accountSid = configService.get<string>('TWILIO_ACCOUNT_SID');
      const authToken = configService.get<string>('TWILIO_AUTH_TOKEN');
      const serviceSid = configService.get<string>('TWILIO_VERIFY_SERVICE_SID');
      if (!accountSid || !authToken || !serviceSid) {
        throw new Error(
          'TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID are required when SMS_PROVIDER=twilio',
        );
      }
      logger.log('Phone provider: Twilio Verify (production)');
      return new TwilioPhoneProvider(accountSid, authToken, serviceSid);
    }

    case 'mock':
    default:
      logger.log(
        'Phone provider: Mock (development — OTP logged to console, always 123456)',
      );
      return new MockPhoneProvider();
  }
}
