import { Logger } from '@nestjs/common';
import type { PhoneProvider } from './phone-provider.interface.js';

const MOCK_OTP = '123456';

export class MockPhoneProvider implements PhoneProvider {
  private readonly logger = new Logger(MockPhoneProvider.name);

  async sendOtp(phone: string, channel: 'whatsapp' | 'sms'): Promise<void> {
    this.logger.log(`[MOCK SMS] OTP for ${phone}: ${MOCK_OTP} (channel: ${channel})`);
    console.log(`[MOCK SMS] OTP for ${phone}: ${MOCK_OTP}`);
  }

  async verifyOtp(phone: string, code: string, _channel: 'whatsapp' | 'sms'): Promise<boolean> {
    const isValid = code === MOCK_OTP;
    if (isValid) {
      console.log(`[MOCK SMS] Verified OTP for ${phone}`);
    }
    return isValid;
  }
}
