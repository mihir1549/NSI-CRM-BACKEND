import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { MetaLeadWebhookService } from './meta-lead.service.js';
import { MetaLeadController } from './meta-lead.controller.js';

@Module({
  imports: [PrismaModule],
  controllers: [MetaLeadController],
  providers: [MetaLeadWebhookService],
  exports: [MetaLeadWebhookService],
})
export class WebhooksModule {}
