import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { MailService } from '../mail/mail.service.js';
import { DistributorSubscriptionHistoryService } from './distributor-subscription-history.service.js';
import { UserRole, LeadStatus } from '@prisma/client';

@Injectable()
export class DistributorCronService {
  private readonly logger = new Logger(DistributorCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
    private readonly historyService: DistributorSubscriptionHistoryService,
  ) {}

  /**
   * Daily at 2:00 AM — expire distributor subscriptions past their grace deadline,
   * send grace reminder emails, and process plan migrations.
   */
  @Cron('0 2 * * *')
  async processExpiredSubscriptions(): Promise<void> {
    const now = new Date();

    // ─── Existing: expire subscriptions past grace deadline ────────────────────
    const expiredSubs = await this.prisma.distributorSubscription.findMany({
      where: {
        status: { in: ['HALTED', 'CANCELLED'] },
        graceDeadline: { not: null, lt: now },
      },
      include: { user: true },
    });

    if (expiredSubs.length > 0) {
      // Find Super Admin
      const superAdmin = await this.prisma.user.findFirst({
        where: { role: UserRole.SUPER_ADMIN },
        orderBy: { createdAt: 'asc' },
      });

      if (!superAdmin) {
        this.logger.error('CRON ERROR: No Super Admin found — skipping distributor expiry run');
      } else {
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

            // Fire-and-forget history log
            this.historyService.log({
              userUuid: sub.userUuid,
              event: 'EXPIRED',
              notes: 'Grace period ended — subscription expired',
            });

            // Fire-and-forget expired email
            const resubscribeUrl = `${this.config.get<string>('FRONTEND_URL', 'https://growithnsi.com')}/distributor/plans`;
            this.mailService.sendSubscriptionExpiredEmail(user.email, {
              fullName: user.fullName,
              resubscribeUrl,
            });

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

    // ─── Existing: Grace period reminder — 3 days before graceDeadline ─────────
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    // Compare date only (strip time): graceDeadline date == threeDaysFromNow date
    const reminderDayStart = new Date(threeDaysFromNow);
    reminderDayStart.setHours(0, 0, 0, 0);
    const reminderDayEnd = new Date(threeDaysFromNow);
    reminderDayEnd.setHours(23, 59, 59, 999);

    const graceSubs = await this.prisma.distributorSubscription.findMany({
      where: {
        status: 'HALTED',
        graceDeadline: {
          gte: reminderDayStart,
          lte: reminderDayEnd,
        },
      },
      include: { user: true },
    });

    for (const sub of graceSubs) {
      try {
        const paymentMethodUrl = await this.getShortUrlForSubscription(sub.razorpaySubscriptionId);
        const graceDeadlineStr = sub.graceDeadline!.toISOString();

        // Fire-and-forget grace reminder email
        this.mailService.sendSubscriptionGraceReminderEmail(sub.user.email, {
          fullName: sub.user.fullName,
          graceDeadline: graceDeadlineStr,
          paymentMethodUrl,
        });

        this.logger.log(`Grace reminder sent to ${sub.user.uuid}`);
      } catch (error) {
        this.logger.error(`Failed to send grace reminder for subscription ${sub.uuid}: ${(error as Error).message}`);
      }
    }

    // ─── CHECK A: Migration reminder — 3 days before currentPeriodEnd ─────────
    await this.processMigrationReminders(now);

    // ─── CHECK B: Migration execution — currentPeriodEnd reached ──────────────
    await this.processMigrationExecution(now);

    // ─── CHECK C: HALTED + migration overlap ─────────────────────────────────
    await this.processMigrationHaltedOverlap(now);
  }

  // ─── CHECK A: Migration reminder (Email 2) ─────────────────────────────────

  private async processMigrationReminders(now: Date): Promise<void> {
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const reminderDayStart = new Date(threeDaysFromNow);
    reminderDayStart.setHours(0, 0, 0, 0);
    const reminderDayEnd = new Date(threeDaysFromNow);
    reminderDayEnd.setHours(23, 59, 59, 999);

    const migrationReminderSubs = await this.prisma.distributorSubscription.findMany({
      where: {
        migrationPending: true,
        status: 'ACTIVE',
        currentPeriodEnd: {
          gte: reminderDayStart,
          lte: reminderDayEnd,
        },
      },
      include: { user: true },
    });

    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'https://growithnsi.com');
    const newPlanUrl = `${frontendUrl}/distributor/plans`;

    for (const sub of migrationReminderSubs) {
      try {
        // Fire-and-forget Email 2
        this.mailService.sendSubscriptionMigrationReminderEmail(sub.user.email, {
          fullName: sub.user.fullName,
          currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
          newPlanUrl,
        });

        this.logger.log(`Migration reminder sent to ${sub.user.uuid}`);
      } catch (error) {
        this.logger.error(`Failed to send migration reminder for ${sub.uuid}: ${(error as Error).message}`);
      }
    }
  }

  // ─── CHECK B: Migration execution ──────────────────────────────────────────

  private async processMigrationExecution(now: Date): Promise<void> {
    const migrationDueSubs = await this.prisma.distributorSubscription.findMany({
      where: {
        migrationPending: true,
        status: 'ACTIVE',
        currentPeriodEnd: { lte: now },
      },
      include: { user: true },
    });

    const isMock = this.config.get<string>('PAYMENT_PROVIDER', 'mock') === 'mock';
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'https://growithnsi.com');
    const newPlanUrl = `${frontendUrl}/distributor/plans`;

    for (const sub of migrationDueSubs) {
      try {
        // Cancel Razorpay subscription (only in production)
        if (!isMock) {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const Razorpay = require('razorpay');
          const razorpay = new Razorpay({
            key_id: this.config.get<string>('RAZORPAY_KEY_ID'),
            key_secret: this.config.get<string>('RAZORPAY_KEY_SECRET'),
          });
          await razorpay.subscriptions.cancel(sub.razorpaySubscriptionId);
        }

        const graceDeadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        // Update subscription
        await this.prisma.distributorSubscription.update({
          where: { uuid: sub.uuid },
          data: {
            status: 'CANCELLED',
            graceDeadline,
            migrationPending: false,
          },
        });

        // Fire-and-forget history log
        this.historyService.log({
          userUuid: sub.userUuid,
          event: 'MIGRATION_CANCELLED',
          notes: 'Plan billing date reached — grace period started',
        });

        // Fire-and-forget Email 3
        this.mailService.sendSubscriptionMigrationEndedEmail(sub.user.email, {
          fullName: sub.user.fullName,
          graceDeadline: graceDeadline.toISOString(),
          newPlanUrl,
        });

        this.logger.log(`Migration execution completed for user ${sub.userUuid} — grace period until ${graceDeadline.toISOString()}`);
      } catch (error) {
        this.logger.error(`Failed to execute migration for subscription ${sub.uuid}: ${(error as Error).message}`);
      }
    }
  }

  // ─── CHECK C: HALTED + migration overlap ───────────────────────────────────

  private async processMigrationHaltedOverlap(now: Date): Promise<void> {
    const haltedMigrationSubs = await this.prisma.distributorSubscription.findMany({
      where: {
        migrationPending: true,
        status: 'HALTED',
        currentPeriodEnd: { lte: now },
      },
    });

    for (const sub of haltedMigrationSubs) {
      try {
        // Clear migration flag only — do NOT override graceDeadline, do NOT send email
        await this.prisma.distributorSubscription.update({
          where: { uuid: sub.uuid },
          data: { migrationPending: false },
        });

        // Fire-and-forget history log
        this.historyService.log({
          userUuid: sub.userUuid,
          event: 'MIGRATION_CANCELLED',
          notes: 'Plan billing date reached — subscription was already HALTED',
        });

        this.logger.log(`Migration cleared for HALTED subscription ${sub.uuid}`);
      } catch (error) {
        this.logger.error(`Failed to clear migration for HALTED subscription ${sub.uuid}: ${(error as Error).message}`);
      }
    }
  }

  private async getShortUrlForSubscription(razorpaySubscriptionId: string): Promise<string> {
    const isMock = this.config.get<string>('PAYMENT_PROVIDER', 'mock') === 'mock';
    if (isMock) {
      return 'https://mock-razorpay.com/update-payment';
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Razorpay = require('razorpay');
    const razorpay = new Razorpay({
      key_id: this.config.get<string>('RAZORPAY_KEY_ID'),
      key_secret: this.config.get<string>('RAZORPAY_KEY_SECRET'),
    });
    const sub = await razorpay.subscriptions.fetch(razorpaySubscriptionId);
    return sub.short_url as string;
  }
}
