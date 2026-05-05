import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SocialModule } from '../social/social.module.js';
import { OnboardingQueueService } from './onboarding-queue.service.js';
import { FollowupQueueService } from './followup-queue.service.js';
import { DropoffQueueService } from './dropoff-queue.service.js';
import { QueueCronService } from './queue-cron.service.js';

@Module({
  imports: [
    PrismaModule,
    // NotificationsModule is @Global() — WhatsAppService available without import
    SocialModule, // exports SocialConfigService
  ],
  providers: [
    OnboardingQueueService,
    FollowupQueueService,
    DropoffQueueService,
    QueueCronService,
  ],
  exports: [
    OnboardingQueueService,
    FollowupQueueService,
    DropoffQueueService,
  ],
})
export class QueueModule {}
