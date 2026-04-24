import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import type { PhoneProvider } from './providers/phone-provider.interface.js';
import { MockPhoneProvider } from './providers/mock-phone.provider.js';
import { TwilioPhoneProvider } from './providers/twilio-phone.provider.js';
import { Msg91PhoneProvider } from './providers/msg91-phone.provider.js';
import { CountryRouterPhoneProvider } from './providers/country-router-phone.provider.js';

const logger = new Logger('PhoneProviderFactory');

export function createPhoneProvider(
  configService: ConfigService,
): PhoneProvider {
  const provider = configService.get<string>('SMS_PROVIDER', 'mock');

  function buildTwilio(): TwilioPhoneProvider {
    const accountSid = configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = configService.get<string>('TWILIO_AUTH_TOKEN');
    const serviceSid = configService.get<string>('TWILIO_VERIFY_SERVICE_SID');
    if (!accountSid || !authToken || !serviceSid) {
      throw new Error(
        'TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID are required',
      );
    }
    return new TwilioPhoneProvider(accountSid, authToken, serviceSid);
  }

  function buildMsg91(): Msg91PhoneProvider {
    const authKey = configService.get<string>('MSG91_AUTH_KEY');
    if (!authKey) {
      throw new Error(
        'MSG91_AUTH_KEY is required when SMS_PROVIDER=msg91 or auto',
      );
    }
    const smsTemplateId = configService.get<string>(
      'MSG91_SMS_TEMPLATE_ID',
      '',
    );
    const whatsappTemplateId = configService.get<string>(
      'MSG91_WHATSAPP_TEMPLATE_ID',
      '',
    );
    const senderId = configService.get<string>('MSG91_SENDER_ID', 'MSGIND');
    return new Msg91PhoneProvider(
      authKey,
      smsTemplateId,
      whatsappTemplateId,
      senderId,
    );
  }

  switch (provider) {
    case 'twilio': {
      logger.log('Phone provider: Twilio Verify (all countries)');
      return buildTwilio();
    }

    case 'msg91': {
      logger.log('Phone provider: MSG91 (all countries)');
      return buildMsg91();
    }

    case 'auto': {
      // India (+91) → MSG91, all others → Twilio.
      // Add further routes by extending the array below — no other code change needed.
      const msg91 = buildMsg91();
      const twilio = buildTwilio();
      logger.log('Phone provider: Auto-router (India→MSG91, others→Twilio)');
      return new CountryRouterPhoneProvider(
        [{ countryCodes: ['91'], provider: msg91 }],
        twilio,
      );
    }

    case 'mock':
    default:
      logger.log('Phone provider: Mock (OTP always 123456)');
      return new MockPhoneProvider();
  }
}
