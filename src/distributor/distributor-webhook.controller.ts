import {
  Controller,
  Post,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import type { Request, Response } from 'express';
import { DistributorSubscriptionService } from './distributor-subscription.service.js';
import { WebhookMessageResponse } from '../common/dto/responses/webhook.responses.js';

@ApiTags('Webhook')
@SkipThrottle()
@Controller({ path: 'distributor', version: '1' })
export class DistributorWebhookController {
  private readonly logger = new Logger(DistributorWebhookController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly subscriptionService: DistributorSubscriptionService,
  ) {}

  /**
   * POST /api/v1/distributor/webhook
   * Razorpay subscription webhook (no auth, signature verified).
   */
  @ApiOperation({ summary: 'Razorpay subscription webhook handler (no auth)' })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed',
    type: WebhookMessageResponse,
  })
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: Request,
    @Res({ passthrough: true }) _res: Response,
  ): Promise<void> {
    const isMock =
      this.config.get<string>('PAYMENT_PROVIDER', 'mock') === 'mock';
    const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
    const bodyStr = rawBody
      ? rawBody.toString('utf-8')
      : JSON.stringify(req.body);

    // Signature verification — skip in mock mode
    if (!isMock) {
      const signature =
        (req.headers['x-razorpay-signature'] as string | undefined) ?? '';
      const webhookSecret = this.config.get<string>(
        'RAZORPAY_WEBHOOK_SECRET',
        '',
      );
      const clientIp =
        (req.headers['x-forwarded-for'] as string | undefined)
          ?.split(',')[0]
          ?.trim() ??
        req.ip ??
        'unknown';

      if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) {
        this.logger.warn(
          `⚠️ SECURITY: Invalid Razorpay webhook signature received from IP ${clientIp}`,
        );
        throw new BadRequestException('Invalid webhook signature');
      }

      const expected = crypto
        .createHmac('sha256', webhookSecret)
        .update(bodyStr)
        .digest('hex');

      if (
        !crypto.timingSafeEqual(
          Buffer.from(expected, 'hex'),
          Buffer.from(signature, 'hex'),
        )
      ) {
        this.logger.warn(
          `⚠️ SECURITY: Invalid Razorpay webhook signature received from IP ${clientIp}`,
        );
        throw new BadRequestException('Invalid webhook signature');
      }
    }

    let event: Record<string, unknown>;
    try {
      event = JSON.parse(bodyStr) as Record<string, unknown>;
    } catch {
      throw new BadRequestException('Invalid webhook payload');
    }

    const eventType = event['event'] as string;
    this.logger.log(`Distributor webhook received: ${eventType}`);

    // Extract subscription entity
    const payload = event['payload'] as Record<string, unknown> | undefined;
    const subscriptionEntity = (
      payload?.['subscription'] as Record<string, unknown> | undefined
    )?.['entity'] as Record<string, unknown> | undefined;
    const razorpaySubscriptionId = subscriptionEntity?.['id'] as
      | string
      | undefined;

    if (!razorpaySubscriptionId) {
      this.logger.warn(
        `Distributor webhook: no subscription id in payload for event ${eventType}`,
      );
      return;
    }

    try {
      switch (eventType) {
        case 'subscription.charged': {
          // Parse current_end from payload (Unix timestamp)
          const currentEnd = subscriptionEntity?.['current_end'] as
            | number
            | undefined;
          const currentPeriodEnd = currentEnd
            ? new Date(currentEnd * 1000)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          // Extract razorpay payment ID from payment entity in payload
          const paymentEntity = (
            payload?.['payment'] as Record<string, unknown> | undefined
          )?.['entity'] as Record<string, unknown> | undefined;
          const razorpayPaymentId = paymentEntity?.['id'] as string | undefined;
          await this.subscriptionService.handleCharged(
            razorpaySubscriptionId,
            currentPeriodEnd,
            razorpayPaymentId,
          );
          break;
        }
        case 'subscription.halted':
          await this.subscriptionService.handleHalted(razorpaySubscriptionId);
          break;
        case 'subscription.cancelled':
        case 'subscription.completed':
          await this.subscriptionService.handleCancelledOrCompleted(
            razorpaySubscriptionId,
          );
          break;
        default:
          this.logger.log(
            `Distributor webhook: unhandled event type ${eventType}`,
          );
      }
    } catch (error) {
      // Log but never return non-200 to Razorpay
      this.logger.error(
        `Error processing distributor webhook ${eventType}: ${(error as Error).message}`,
      );
    }
  }
}
