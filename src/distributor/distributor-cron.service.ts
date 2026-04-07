import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { MailService } from '../mail/mail.service.js';
import { UserRole, LeadStatus } from '@prisma/client';

@Injectable()
export class DistributorCronService {
  private readonly logger = new Logger(DistributorCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Daily at 2:00 AM — expire distributor subscriptions past their grace deadline.
   */
  @Cron('0 2 * * *')
  async processExpiredSubscriptions(): Promise<void> {
    const now = new Date();

    // Find all HALTED or CANCELLED subscriptions past their grace deadline
    const expiredSubs = await this.prisma.distributorSubscription.findMany({
      where: {
        status: { in: ['HALTED', 'CANCELLED'] },
        graceDeadline: { not: null, lt: now },
      },
      include: { user: true },
    });

    if (expiredSubs.length === 0) return;

    // Find Super Admin
    const superAdmin = await this.prisma.user.findFirst({
      where: { role: UserRole.SUPER_ADMIN },
      orderBy: { createdAt: 'asc' },
    });

    if (!superAdmin) {
      this.logger.error('CRON ERROR: No Super Admin found — skipping distributor expiry run');
      return;
    }

    for (const sub of expiredSubs) {
      try {
        const user = sub.user;

        // Safety check: never downgrade a Super Admin
        if (user.role === UserRole.SUPER_ADMIN) {
          this.logger.warn(`Skipping Super Admin user ${user.uuid} in distributor expiry cron`);
          continue;
        }

        // Mark subscription as expired
        await this.prisma.distributorSubscription.update({
          where: { uuid: sub.uuid },
          data: { status: 'EXPIRED' },
        });

        // Downgrade role and deactivate join link
        await this.prisma.user.update({
          where: { uuid: user.uuid },
          data: { role: UserRole.CUSTOMER, joinLinkActive: false },
        });

        // Reassign HOT leads to Super Admin
        const result = await this.prisma.lead.updateMany({
          where: { distributorUuid: user.uuid, status: LeadStatus.HOT },
          data: { assignedToUuid: superAdmin.uuid },
        });
        const leadsReassigned = result.count;

        // Fire-and-forget expired email
        this.mailService.sendSubscriptionExpiredEmail(user.email, user.fullName);

        // Audit log
        this.audit.log({
          actorUuid: superAdmin.uuid,
          action: 'DISTRIBUTOR_SUBSCRIPTION_EXPIRED',
          metadata: {
            distributorUuid: user.uuid,
            distributorName: user.fullName,
            leadsReassigned,
          },
          ipAddress: 'cron',
        });

        this.logger.log(`Expired distributor subscription for user ${user.uuid}, reassigned ${leadsReassigned} leads`);
      } catch (error) {
        this.logger.error(`Failed to process expired subscription ${sub.uuid}: ${(error as Error).message}`);
      }
    }
  }
}
