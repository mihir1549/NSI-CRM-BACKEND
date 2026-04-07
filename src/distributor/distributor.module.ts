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

import { DistributorController } from './distributor.controller.js';
import { DistributorAdminController } from './distributor-admin.controller.js';
import { DistributorWebhookController } from './distributor-webhook.controller.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    AuditModule,
    MailModule,
  ],
  controllers: [
    DistributorController,
    DistributorAdminController,
    DistributorWebhookController,
  ],
  providers: [
    DistributorPlanService,
    DistributorSubscriptionService,
    DistributorCronService,
    DistributorService,
  ],
  exports: [
    DistributorSubscriptionService,
  ],
})
export class DistributorModule {}
