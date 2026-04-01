export interface PaymentProvider {
  createOrder(
    amount: number,
    currency: string,
    receiptId: string,
  ): Promise<{
    orderId: string;
    amount: number;
    currency: string;
  }>;
  verifyWebhookSignature(body: string, signature: string): boolean;
  verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean;
}

export const PAYMENT_PROVIDER_TOKEN = 'PAYMENT_PROVIDER';
