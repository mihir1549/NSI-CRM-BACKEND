import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { MailModule } from '../mail/mail.module.js';
import { UsersModule } from '../users/users.module.js';
import { DistributorModule } from '../distributor/distributor.module.js';
import { StorageModule } from '../common/storage/storage.module.js';

import { UsersAdminService } from './users-admin.service.js';
import { UsersAdminController } from './users-admin.controller.js';

import { DistributorsAdminService } from './distributors-admin.service.js';
import { DistributorsAdminController } from './distributors-admin.controller.js';

import { AnalyticsAdminService } from './analytics-admin.service.js';
import { AnalyticsAdminController } from './analytics-admin.controller.js';

import { CampaignAdminController } from './campaign-admin.controller.js';
import { CampaignModule } from '../campaign/campaign.module.js';
import { NotificationsAdminController } from './notifications-admin.controller.js';
import { LeadsModule } from '../leads/leads.module.js';

@Module({
  imports: [
    AuthModule,
    AuditModule,
    MailModule,
    UsersModule,
    CampaignModule,
    StorageModule,
    forwardRef(() => LeadsModule),
    forwardRef(() => DistributorModule),
  ],
  controllers: [
    UsersAdminController,
    DistributorsAdminController,
    AnalyticsAdminController,
    CampaignAdminController,
    NotificationsAdminController,
  ],
  providers: [
    UsersAdminService,
    DistributorsAdminService,
    AnalyticsAdminService,
  ],
})
export class AdminModule {}
