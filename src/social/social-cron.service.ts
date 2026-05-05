import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { SocialPostService } from './social-post.service.js';
import { SocialConfigService } from './social-config.service.js';

@Injectable()
export class SocialCronService implements OnModuleInit {
  private readonly logger = new Logger(SocialCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly socialPostService: SocialPostService,
    private readonly configService: SocialConfigService,
  ) {}

  onModuleInit(): void {
    this.logger.log('Cron job registered: generateDailyPosts');
  }

  @Cron('0 7 * * *', { timeZone: 'Asia/Kolkata' })
  async generateDailyPosts(): Promise<void> {
    const batchSize = await this.configService.getNumber('BATCH_SIZE', 10);

    const distributors = await this.prisma.user.findMany({
      where: {
        role: 'DISTRIBUTOR',
        status: 'ACTIVE',
        distributorSubscription: {
          status: { in: ['ACTIVE', 'GRACE'] },
        },
      },
      select: { uuid: true },
    });

    this.logger.log(
      `[SocialCron] Starting daily post generation for ${distributors.length} distributors`,
    );

    for (let i = 0; i < distributors.length; i += batchSize) {
      const batch = distributors.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map((d) =>
          this.socialPostService.generatePostsForDistributor(d.uuid),
        ),
      );

      let succeeded = 0;
      let skipped = 0;
      let failed = 0;

      for (const result of results) {
        if (result.status === 'fulfilled') {
          succeeded++;
        } else if (
          typeof result.reason?.message === 'string' &&
          result.reason.message.includes('skipping')
        ) {
          skipped++;
        } else {
          failed++;
        }
      }

      this.logger.log(
        `[SocialCron] Batch ${Math.floor(i / batchSize) + 1}: ` +
          `${succeeded} generated, ${skipped} skipped, ${failed} failed`,
      );

      if (i + batchSize < distributors.length) {
        await new Promise<void>((resolve) => setTimeout(resolve, 1000));
      }
    }

    this.logger.log('[SocialCron] Daily generation complete');
  }
}
