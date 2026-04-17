import { Module } from '@nestjs/common';
import { FunnelCmsController } from './funnel-cms.controller.js';
import { AnalyticsController } from './analytics.controller.js';
import { FunnelCmsService } from './funnel-cms.service.js';
import { FunnelValidationService } from './funnel-validation.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';
@Module({
  imports: [PrismaModule, AuthModule, UsersModule],
  controllers: [FunnelCmsController, AnalyticsController],
  providers: [FunnelCmsService, FunnelValidationService],
})
export class FunnelCmsModule {}
