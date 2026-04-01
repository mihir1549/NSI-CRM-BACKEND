import { Logger } from '@nestjs/common';
import type { PhoneProvider } from './phone-provider.interface.js';

export class TwilioPhoneProvider implements PhoneProvider {
  private readonly logger = new Logger(TwilioPhoneProvider.name);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly client: any;
  private readonly serviceSid: string;

  constructor(accountSid: string, authToken: string, serviceSid: string) {
    // Dynamic import to avoid hard dependency at module load time
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const twilio = require('twilio');
    this.client = twilio(accountSid, authToken);
    this.serviceSid = serviceSid;
  }

  async sendOtp(phone: string, channel: 'whatsapp' | 'sms'): Promise<void> {
    await this.client.verify.v2
      .services(this.serviceSid)
      .verifications.create({ to: phone, channel });
    this.logger.log(`Twilio OTP sent to ${phone} via ${channel}`);
  }

  async verifyOtp(phone: string, code: string, channel: 'whatsapp' | 'sms'): Promise<boolean> {
    const verification = await this.client.verify.v2
      .services(this.serviceSid)
      .verificationChecks.create({ to: phone, code, channel });
    return verification.status === 'approved';
  }
}
