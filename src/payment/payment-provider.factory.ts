import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import type { PaymentProvider } from './providers/payment-provider.interface.js';
import { MockPaymentProvider } from './providers/mock-payment.provider.js';
import { RazorpayPaymentProvider } from './providers/razorpay-payment.provider.js';

const logger = new Logger('PaymentProviderFactory');

export function createPaymentProvider(
  configService: ConfigService,
): PaymentProvider {
  const provider = configService.get<string>('PAYMENT_PROVIDER', 'mock');

  switch (provider) {
    case 'razorpay': {
      const keyId = configService.get<string>('RAZORPAY_KEY_ID');
      const keySecret = configService.get<string>('RAZORPAY_KEY_SECRET');
      const webhookSecret = configService.get<string>(
        'RAZORPAY_WEBHOOK_SECRET',
      );
      if (!keyId || !keySecret || !webhookSecret) {
        throw new Error(
          'RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and RAZORPAY_WEBHOOK_SECRET are required when PAYMENT_PROVIDER=razorpay',
        );
      }
      logger.log('Payment provider: Razorpay (production)');
      return new RazorpayPaymentProvider(keyId, keySecret, webhookSecret);
    }

    case 'mock':
    default:
      logger.log(
        'Payment provider: Mock (development — payments auto-confirm after 2s)',
      );
      return new MockPaymentProvider();
  }
}
