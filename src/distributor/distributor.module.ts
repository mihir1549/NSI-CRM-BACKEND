import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { MailModule } from '../mail/mail.module.js';

import { DistributorPlanService } from './distributor-plan.service.js';
import { DistributorSubscriptionService } from './distributor-subscription.service.js';
import { DistributorCronService } from './distributor-cron.service.js';
import { DistributorService } from './distributor.service.js';
import { DistributorTaskService } from './distributor-task.service.js';
import { DistributorCalendarService } from './distributor-calendar.service.js';

import { DistributorController } from './distributor.controller.js';
import { DistributorAdminController } from './distributor-admin.controller.js';
import { DistributorWebhookController } from './distributor-webhook.controller.js';
import { DistributorCampaignController } from './distributor-campaign.controller.js';
import { CampaignModule } from '../campaign/campaign.module.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    AuditModule,
    MailModule,
    CampaignModule,
  ],
  controllers: [
    DistributorController,
    DistributorAdminController,
    DistributorWebhookController,
    DistributorCampaignController,
  ],
  providers: [
    DistributorPlanService,
    DistributorSubscriptionService,
    DistributorCronService,
    DistributorService,
    DistributorTaskService,
    DistributorCalendarService,
  ],
  exports: [
    DistributorSubscriptionService,
  ],
})
export class DistributorModule {}
