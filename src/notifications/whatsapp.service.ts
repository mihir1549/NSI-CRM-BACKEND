import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly client: any | null = null;
  private readonly fromNumber: string | null = null;
  private readonly enabled: boolean = false;

  constructor(private readonly config: ConfigService) {
    const accountSid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.config.get<string>('TWILIO_AUTH_TOKEN');
    const fromNumber = this.config.get<string>('TWILIO_WHATSAPP_FROM');

    if (accountSid && authToken && fromNumber) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const twilio = require('twilio');
      this.client = twilio(accountSid, authToken);
      this.fromNumber = fromNumber;
      this.enabled = true;
      this.logger.log('[WhatsApp] Twilio client initialized');
    } else {
      this.logger.warn(
        '[WhatsApp] Disabled — TWILIO_WHATSAPP_FROM not configured (mock mode)',
      );
    }
  }

  async sendMessage(phone: string, body: string): Promise<void> {
    if (!this.enabled || !this.client || !this.fromNumber) {
      this.logger.log(
        `[WhatsApp MOCK] To: ${phone}, Body: ${body.slice(0, 80)}${body.length > 80 ? '...' : ''}`,
      );
      return;
    }

    const to = phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`;
    const from = this.fromNumber.startsWith('whatsapp:')
      ? this.fromNumber
      : `whatsapp:${this.fromNumber}`;

    await this.client.messages.create({ from, to, body });
    this.logger.log(`[WhatsApp] Sent to ${phone}`);
  }
}
