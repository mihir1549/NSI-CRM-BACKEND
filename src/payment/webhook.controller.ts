import {
  Controller,
  Post,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { PaymentService } from './payment.service.js';

/**
 * WebhookController — handles Razorpay webhook events.
 *
 * CRITICAL:
 * - No JWT guard — Razorpay calls this endpoint directly
 * - No OnboardingGuard
 * - Raw body REQUIRED for signature verification (enabled via rawBody: true in NestFactory.create)
 * - ALWAYS returns 200 — Razorpay will retry forever on non-200
 */
@Controller('payments')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly paymentService: PaymentService) {}

  // POST /api/v1/payments/webhook
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Req() req: RawBodyRequest<Request>) {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

    // Get raw body as string — CRITICAL for signature verification
    const rawBody = req.rawBody?.toString() ?? '';
    const signature = ((req.headers['x-razorpay-signature'] as string) ?? '').trim();

    this.logger.debug(`Webhook received — signature length: ${signature.length}, signature: ${signature.substring(0, 20)}...`);

    try {
      await this.paymentService.handleWebhook(rawBody, signature, ipAddress);
    } catch (error) {
      // NEVER return non-200 to Razorpay — log internally and return 200
      this.logger.error('Webhook processing error (returning 200 anyway):', error);
    }

    // Always return 200 OK
    return { ok: true };
  }
}
