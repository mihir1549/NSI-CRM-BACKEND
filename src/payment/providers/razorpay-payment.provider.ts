import * as crypto from 'crypto';
import { Logger } from '@nestjs/common';
import type { PaymentProvider } from './payment-provider.interface.js';

export class RazorpayPaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(RazorpayPaymentProvider.name);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly razorpay: any;
  private readonly keySecret: string;
  private readonly webhookSecret: string;

  constructor(keyId: string, keySecret: string, webhookSecret: string) {
    // Dynamic require to avoid hard dependency at module load time
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Razorpay = require('razorpay');
    this.razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    this.keySecret = keySecret;
    this.webhookSecret = webhookSecret;
  }

  async createOrder(
    amount: number,
    currency: string,
    receiptId: string,
  ): Promise<{ orderId: string; amount: number; currency: string }> {
    const order = await this.razorpay.orders.create({
      amount: amount * 100,
      currency,
      receipt: receiptId,
    });
    this.logger.log(`Razorpay order created: ${order.id}`);
    return { orderId: order.id, amount: order.amount, currency: order.currency };
  }

  verifyWebhookSignature(body: string, signature: string): boolean {
    // Guard: reject empty or non-hex signatures before timingSafeEqual
    if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) {
      this.logger.warn('Webhook signature missing or malformed');
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(body)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(signature, 'hex'),
    );
  }

  verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
    if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) {
      this.logger.warn('Payment signature missing or malformed');
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(signature, 'hex'),
    );
  }
}
