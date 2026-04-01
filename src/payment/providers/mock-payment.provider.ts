import { Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import type { PaymentProvider } from './payment-provider.interface.js';

export class MockPaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(MockPaymentProvider.name);

  async createOrder(
    amount: number,
    currency: string,
    receiptId: string,
  ): Promise<{ orderId: string; amount: number; currency: string }> {
    const orderId = `mock_order_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
    console.log(`[MOCK PAYMENT] Created order: ${orderId} for amount=${amount} ${currency} receipt=${receiptId}`);
    this.logger.log(`[MOCK PAYMENT] Order created: ${orderId}`);
    return { orderId, amount, currency };
  }

  verifyWebhookSignature(_body: string, _signature: string): boolean {
    console.log('[MOCK PAYMENT] Webhook signature verified (always true in mock mode)');
    return true;
  }

  verifyPaymentSignature(_orderId: string, _paymentId: string, _signature: string): boolean {
    console.log('[MOCK PAYMENT] Payment signature verified (always true in mock mode)');
    return true;
  }
}
