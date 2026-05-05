import {
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { MetaLeadWebhookService } from './meta-lead.service.js';

@Controller({ path: 'webhooks', version: '1' })
export class MetaLeadController {
  private readonly logger = new Logger(MetaLeadController.name);

  constructor(
    private readonly metaLeadWebhookService: MetaLeadWebhookService,
  ) {}

  // Meta verification handshake
  @Get('meta')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ): Response {
    const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;
    if (mode === 'subscribe' && token && expected && token === expected) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }

  // Receive Lead Ad form submissions
  @Post('meta')
  @HttpCode(200)
  receiveWebhook(@Body() body: unknown): { received: true } {
    // Always return 200 immediately — Meta retries on non-200
    this.metaLeadWebhookService.processPayload(body).catch((err) =>
      this.logger.error(
        `[MetaWebhook] processPayload failed: ${(err as Error).message}`,
      ),
    );
    return { received: true };
  }
}
