import { Logger } from '@nestjs/common';
import type { PhoneProvider } from './phone-provider.interface.js';

export interface CountryRoute {
  countryCodes: string[];
  provider: PhoneProvider;
}

export class CountryRouterPhoneProvider implements PhoneProvider {
  private readonly logger = new Logger(CountryRouterPhoneProvider.name);

  constructor(
    private readonly routes: CountryRoute[],
    private readonly defaultProvider: PhoneProvider,
  ) {}

  private resolve(phone: string): {
    provider: PhoneProvider;
    countryCode: string | null;
  } {
    const normalized = phone.replace(/^\+/, '');

    for (const route of this.routes) {
      for (const code of route.countryCodes) {
        if (normalized.startsWith(code)) {
          this.logger.debug(`Routing ${phone} → country code +${code}`);
          return { provider: route.provider, countryCode: code };
        }
      }
    }

    this.logger.debug(`No route match for ${phone} → using default provider`);
    return { provider: this.defaultProvider, countryCode: null };
  }

  async sendOtp(
    phone: string,
    channel: 'whatsapp' | 'sms',
  ): Promise<void> {
    const { provider } = this.resolve(phone);
    return provider.sendOtp(phone, channel);
  }

  async verifyOtp(
    phone: string,
    code: string,
    channel: 'whatsapp' | 'sms',
  ): Promise<boolean> {
    const { provider } = this.resolve(phone);
    return provider.verifyOtp(phone, code, channel);
  }
}
