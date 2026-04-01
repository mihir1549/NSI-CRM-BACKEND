import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NurtureStatus, LeadStatus, LeadAction } from '@prisma/client';

@Injectable()
export class NurtureService {
  private readonly logger = new Logger(NurtureService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Nurture cron — runs every hour on the hour.
   * Processes all ACTIVE nurture enrollments whose nextEmailAt has passed.
   *
   * Sequence:
   *   Day 1: nextEmailAt=now+1d  → sends Day 1 email, sets day1SentAt, nextEmailAt=now+2d
   *   Day 3: nextEmailAt=now+2d  → sends Day 3 email, sets day3SentAt, nextEmailAt=now+4d
   *   Day 7: nextEmailAt=now+4d  → sends Day 7 email, sets day7SentAt, status=COMPLETED
   *                                Also sets Lead.status=LOST + logs LeadActivity
   */
  @Cron('0 * * * *')
  async processNurtureEmails(): Promise<void> {
    const now = new Date();

    const dueEnrollments = await this.prisma.nurtureEnrollment.findMany({
      where: {
        status: NurtureStatus.ACTIVE,
        nextEmailAt: { lte: now },
      },
      include: {
        user: { select: { uuid: true, email: true, fullName: true } },
        lead: { select: { uuid: true, status: true } },
      },
    });

    if (dueEnrollments.length === 0) return;

    this.logger.log(`Processing ${dueEnrollments.length} nurture enrollment(s)`);

    for (const enrollment of dueEnrollments) {
      try {
        await this.processSingleEnrollment(enrollment, now);
      } catch (error) {
        this.logger.error(
          `Failed to process nurture enrollment ${enrollment.uuid}: ${(error as Error).message}`,
        );
      }
    }
  }

  private async processSingleEnrollment(
    enrollment: {
      uuid: string;
      userUuid: string;
      leadUuid: string;
      day1SentAt: Date | null;
      day3SentAt: Date | null;
      day7SentAt: Date | null;
      user: { uuid: string; email: string; fullName: string };
      lead: { uuid: string; status: LeadStatus };
    },
    now: Date,
  ): Promise<void> {
    const { user, lead } = enrollment;

    if (!enrollment.day1SentAt) {
      // ── Day 1 email ──────────────────────────────────────────
      this.mail.sendNurtureDay1(user.email, user.fullName);

      await this.prisma.nurtureEnrollment.update({
        where: { uuid: enrollment.uuid },
        data: {
          day1SentAt: now,
          nextEmailAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), // +2 days
        },
      });

      this.logger.log(`Nurture Day 1 email queued for user ${user.uuid}`);
    } else if (!enrollment.day3SentAt) {
      // ── Day 3 email ──────────────────────────────────────────
      this.mail.sendNurtureDay3(user.email, user.fullName);

      await this.prisma.nurtureEnrollment.update({
        where: { uuid: enrollment.uuid },
        data: {
          day3SentAt: now,
          nextEmailAt: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000), // +4 days
        },
      });

      this.logger.log(`Nurture Day 3 email queued for user ${user.uuid}`);
    } else if (!enrollment.day7SentAt) {
      // ── Day 7 email (final) ──────────────────────────────────
      this.mail.sendNurtureDay7(user.email, user.fullName);

      // Mark enrollment as COMPLETED
      await this.prisma.nurtureEnrollment.update({
        where: { uuid: enrollment.uuid },
        data: {
          day7SentAt: now,
          nextEmailAt: null,
          status: NurtureStatus.COMPLETED,
        },
      });

      // Move lead to LOST
      const prevStatus = lead.status;
      await this.prisma.lead.update({
        where: { uuid: lead.uuid },
        data: { status: LeadStatus.LOST },
      });

      // Log activity (use system actor = lead's own userUuid as actor)
      await this.prisma.leadActivity.create({
        data: {
          leadUuid: lead.uuid,
          actorUuid: enrollment.userUuid,
          fromStatus: prevStatus,
          toStatus: LeadStatus.LOST,
          action: LeadAction.STATUS_CHANGE,
          notes: 'Nurture sequence completed — no response after Day 7 email',
        },
      });

      // Audit log
      this.audit.log({
        actorUuid: enrollment.userUuid,
        action: 'NURTURE_SEQUENCE_COMPLETED',
        metadata: { leadUuid: lead.uuid, enrollmentUuid: enrollment.uuid },
        ipAddress: 'system',
      });

      this.logger.log(`Nurture sequence completed for user ${user.uuid} — lead set to LOST`);
    }
  }
}
