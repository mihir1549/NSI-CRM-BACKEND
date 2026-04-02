import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { MailModule } from '../mail/mail.module.js';
import { UsersModule } from '../users/users.module.js';

import { UsersAdminService } from './users-admin.service.js';
import { UsersAdminController } from './users-admin.controller.js';

import { DistributorsAdminService } from './distributors-admin.service.js';
import { DistributorsAdminController } from './distributors-admin.controller.js';

import { AnalyticsAdminService } from './analytics-admin.service.js';
import { AnalyticsAdminController } from './analytics-admin.controller.js';

@Module({
  imports: [
    AuthModule,
    AuditModule,
    MailModule,
    UsersModule,
  ],
  controllers: [
    UsersAdminController,
    DistributorsAdminController,
    AnalyticsAdminController,
  ],
  providers: [
    UsersAdminService,
    DistributorsAdminService,
    AnalyticsAdminService,
  ],
})
export class AdminModule {}
