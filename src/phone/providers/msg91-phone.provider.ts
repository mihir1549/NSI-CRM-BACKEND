import { Logger } from '@nestjs/common';
import type { PhoneProvider } from './phone-provider.interface.js';

type Msg91Response = { type?: string; message?: string };

export class Msg91PhoneProvider implements PhoneProvider {
  private readonly logger = new Logger(Msg91PhoneProvider.name);
  private readonly authKey: string;
  private readonly smsTemplateId: string;
  private readonly whatsappTemplateId: string;
  private readonly senderId: string;

  constructor(
    authKey: string,
    smsTemplateId: string,
    whatsappTemplateId: string,
    senderId: string,
  ) {
    this.authKey = authKey;
    this.smsTemplateId = smsTemplateId;
    this.whatsappTemplateId = whatsappTemplateId;
    this.senderId = senderId;
  }

  private stripPlus(phone: string): string {
    return phone.replace(/^\+/, '');
  }

  async sendOtp(
    phone: string,
    channel: 'whatsapp' | 'sms',
  ): Promise<void> {
    const mobile = this.stripPlus(phone);

    if (channel === 'sms') {
      await this.sendSmsOtp(mobile);
    } else {
      await this.sendWhatsappOtp(mobile);
    }
  }

  private async sendSmsOtp(mobile: string): Promise<void> {
    const url = new URL('https://control.msg91.com/api/v5/otp');
    url.searchParams.set('mobile', mobile);
    url.searchParams.set('authkey', this.authKey);
    if (this.smsTemplateId) {
      url.searchParams.set('template_id', this.smsTemplateId);
    }
    url.searchParams.set('otp_length', '6');
    url.searchParams.set('otp_expiry', '10');
    if (this.senderId) {
      url.searchParams.set('sender', this.senderId);
    }

    const response = await fetch(url.toString(), { method: 'POST' });
    const data = (await response.json()) as Msg91Response;

    if (data.type !== 'success') {
      this.logger.error(`MSG91 SMS OTP send failed: ${JSON.stringify(data)}`);
      throw new Error(`MSG91 SMS OTP failed: ${data.message ?? 'unknown'}`);
    }
    this.logger.log(`MSG91 SMS OTP sent to ${mobile}`);
  }

  private async sendWhatsappOtp(mobile: string): Promise<void> {
    const response = await fetch(
      'https://control.msg91.com/api/v5/whatsapp/whatsapp-otp',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authkey: this.authKey,
        },
        body: JSON.stringify({
          mobile,
          template_id: this.whatsappTemplateId,
        }),
      },
    );
    const data = (await response.json()) as Msg91Response;

    if (data.type !== 'success') {
      this.logger.error(
        `MSG91 WhatsApp OTP send failed: ${JSON.stringify(data)}`,
      );
      throw new Error(
        `MSG91 WhatsApp OTP failed: ${data.message ?? 'unknown'}`,
      );
    }
    this.logger.log(`MSG91 WhatsApp OTP sent to ${mobile}`);
  }

  async verifyOtp(
    phone: string,
    code: string,
    channel: 'whatsapp' | 'sms',
  ): Promise<boolean> {
    const mobile = this.stripPlus(phone);
    const url = new URL('https://control.msg91.com/api/v5/otp/verify');
    url.searchParams.set('mobile', mobile);
    url.searchParams.set('authkey', this.authKey);
    url.searchParams.set('otp', code);
    if (channel === 'whatsapp') {
      url.searchParams.set('type', 'whatsapp');
    }

    const response = await fetch(url.toString(), { method: 'GET' });
    const data = (await response.json()) as Msg91Response;

    if (data.type === 'success') {
      this.logger.log(`MSG91 OTP verified for ${mobile}`);
      return true;
    }
    this.logger.warn(
      `MSG91 OTP verification failed for ${mobile}: ${data.message ?? 'unknown'}`,
    );
    return false;
  }
}
