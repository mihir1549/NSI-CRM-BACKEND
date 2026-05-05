import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OnboardingQueueService } from './onboarding-queue.service.js';
import { FollowupQueueService } from './followup-queue.service.js';
import { DropoffQueueService } from './dropoff-queue.service.js';

@Injectable()
export class QueueCronService implements OnModuleInit {
  private readonly logger = new Logger(QueueCronService.name);

  constructor(
    private readonly onboardingQueue: OnboardingQueueService,
    private readonly followupQueue: FollowupQueueService,
    private readonly dropoffQueue: DropoffQueueService,
  ) {}

  onModuleInit(): void {
    this.logger.log('Cron registered: processOnboarding');
    this.logger.log('Cron registered: processFollowups');
    this.logger.log('Cron registered: processDropoffs');
  }

  // Onboarding — every 30 minutes
  @Cron('*/30 * * * *')
  async processOnboarding(): Promise<void> {
    this.logger.log('[QueueCron] Processing onboarding queue');
    await this.onboardingQueue.sendPendingOnboarding();
  }

  // Follow-up — daily at 9 AM IST
  @Cron('0 9 * * *', { timeZone: 'Asia/Kolkata' })
  async processFollowups(): Promise<void> {
    this.logger.log('[QueueCron] Processing follow-up queue');
    await this.followupQueue.sendPendingFollowups();
  }

  // Dropoff — every 30 minutes (time-sensitive 2hr window)
  @Cron('*/30 * * * *')
  async processDropoffs(): Promise<void> {
    this.logger.log('[QueueCron] Processing dropoff queue');
    await this.dropoffQueue.sendPendingDropoffs();
  }
}
