import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { MailService } from '../mail/mail.service.js';
import { DistributorSubscriptionHistoryService } from '../distributor/distributor-subscription-history.service.js';
import type { UpdateUserRoleDto } from './dto/update-user-role.dto.js';

@Injectable()
export class UsersAdminService {
  private readonly logger = new Logger(UsersAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
    private readonly historyService: DistributorSubscriptionHistoryService,
  ) {}

  /**
   * List users with filters and pagination.
   */
  async listUsers(query: {
    role?: string;
    status?: string;
    country?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: any = {
      AND: [{ role: { not: 'SUPER_ADMIN' } }],
    };

    if (query.role) {
      where.AND.push({ role: query.role.toUpperCase() });
    }
    if (query.status) {
      where.AND.push({ status: query.status.toUpperCase() });
    }
    if (query.country) {
      where.AND.push({ country: query.country });
    }
    if (query.search) {
      where.AND.push({
        OR: [
          { fullName: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          profile: true,
          funnelProgress: {
            include: { stepProgress: { where: { isCompleted: true } } },
          },
          leadAsUser: {
            select: {
              status: true,
              distributorUuid: true,
              distributor: {
                select: {
                  fullName: true,
                  distributorCode: true,
                },
              },
            },
          },
          payments: { where: { status: 'SUCCESS' }, select: { uuid: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    // Get total active funnel steps for progress calculation
    const totalSteps = await this.prisma.funnelStep.count({
      where: { isActive: true },
    });

    const items = users.map((u) => ({
      uuid: u.uuid,
      fullName: u.fullName,
      email: u.email,
      avatarUrl: u.avatarUrl ?? null,
      role: u.role,
      status: u.status,
      country: u.country ?? null,
      createdAt: u.createdAt,
      suspendedAt: u.suspendedAt ?? null,
      phone: u.profile?.phone ?? null,
      phoneVerified: u.profile?.phoneVerifiedAt != null,
      paymentCompleted: u.funnelProgress?.paymentCompleted ?? false,
      funnelProgress: {
        completedSteps: u.funnelProgress?.stepProgress?.length ?? 0,
        totalSteps,
      },
      leadStatus: u.leadAsUser?.status ?? null,
      referredBy: this.mapReferredBy(u.leadAsUser),
    }));

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Get full user detail.
   */
  async getUserDetail(uuid: string) {
    const user = await this.prisma.user.findUnique({
      where: { uuid },
      include: {
        profile: true,
        funnelProgress: {
          include: {
            stepProgress: {
              include: { step: true },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          select: {
            uuid: true,
            amount: true,
            finalAmount: true,
            currency: true,
            status: true,
            paymentType: true,
            createdAt: true,
          },
        },
        leadAsUser: {
          include: {
            distributor: {
              select: {
                fullName: true,
                distributorCode: true,
              },
            },
            activities: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
        enrollments: {
          include: {
            course: {
              include: {
                sections: { include: { lessons: true } },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const totalSteps = await this.prisma.funnelStep.count({
      where: { isActive: true },
    });
    const activeSessions = await this.prisma.authSession.count({
      where: { userUuid: uuid, expiresAt: { gt: new Date() } },
    });

    // Build LMS progress
    const lmsProgress = user.enrollments.map((enrollment) => {
      const allLessons = enrollment.course.sections.flatMap((s) => s.lessons);
      const totalLessons = allLessons.length;
      // We don't have lessonProgress here — calculate from completedAt
      const progress = enrollment.completedAt != null ? 100 : 0;

      return {
        courseUuid: enrollment.courseUuid,
        courseTitle: enrollment.course.title,
        enrolledAt: enrollment.enrolledAt,
        completedAt: enrollment.completedAt ?? null,
        progress,
        certificateUrl: enrollment.certificateUrl ?? null,
      };
    });

    // Fetch lesson progress for more accurate progress calculation
    const lessonProgressData = await this.prisma.lessonProgress.findMany({
      where: { userUuid: uuid },
      select: { lessonUuid: true, isCompleted: true },
    });
    const completedLessonUuids = new Set(
      lessonProgressData
        .filter((lp) => lp.isCompleted)
        .map((lp) => lp.lessonUuid),
    );

    const lmsProgressWithAccurate = user.enrollments.map((enrollment) => {
      const allLessons = enrollment.course.sections.flatMap((s) => s.lessons);
      const totalLessons = allLessons.length;
      const completedCount =
        totalLessons > 0
          ? allLessons.filter((l) => completedLessonUuids.has(l.uuid)).length
          : 0;
      const progress =
        totalLessons > 0
          ? Math.round((completedCount / totalLessons) * 100)
          : 0;

      return {
        courseUuid: enrollment.courseUuid,
        courseTitle: enrollment.course.title,
        enrolledAt: enrollment.enrolledAt,
        completedAt: enrollment.completedAt ?? null,
        progress,
        certificateUrl: enrollment.certificateUrl ?? null,
      };
    });

    // Suppress unused variable warning
    void lmsProgress;

    const lead = user.leadAsUser;
    const leadDetail = lead
      ? {
          uuid: lead.uuid,
          status: lead.status,
          createdAt: lead.createdAt,
          lastActivityAt: lead.activities[0]?.createdAt ?? null,
          lastActivityNote: lead.activities[0]?.notes ?? null,
        }
      : null;

    return {
      uuid: user.uuid,
      fullName: user.fullName,
      email: user.email,
      avatarUrl: user.avatarUrl ?? null,
      role: user.role,
      status: user.status,
      country: user.country ?? null,
      createdAt: user.createdAt,
      suspendedAt: user.suspendedAt ?? null,
      phone: user.profile?.phone ?? null,
      phoneVerified: user.profile?.phoneVerifiedAt != null,
      paymentCompleted: user.funnelProgress?.paymentCompleted ?? false,
      funnelProgress: {
        completedSteps:
          user.funnelProgress?.stepProgress?.filter((sp) => sp.isCompleted)
            .length ?? 0,
        totalSteps,
      },
      leadStatus: user.leadAsUser?.status ?? null,
      paymentHistory: user.payments,
      funnelStepProgress: (user.funnelProgress?.stepProgress ?? []).map(
        (sp) => ({
          stepUuid: sp.stepUuid,
          stepType: sp.step.type,
          stepOrder: sp.step.order,
          isCompleted: sp.isCompleted,
          watchedSeconds: sp.watchedSeconds,
          completedAt: sp.completedAt ?? null,
        }),
      ),
      leadDetail,
      referredBy: this.mapReferredBy(user.leadAsUser),
      lmsProgress: lmsProgressWithAccurate,
      activeSessions,
    };
  }

  /**
   * Helper to map lead distributor info to referredBy object.
   */
  private mapReferredBy(lead: any) {
    if (!lead || !lead.distributorUuid) {
      return { type: 'DIRECT', distributorName: null, distributorCode: null };
    }
    return {
      type: 'DISTRIBUTOR',
      distributorName: lead.distributor?.fullName ?? null,
      distributorCode: lead.distributor?.distributorCode ?? null,
    };
  }

  /**
   * Suspend a user account.
   * STEP 8: If user is DISTRIBUTOR, cancel their Razorpay subscription first.
   */
  async suspendUser(uuid: string, actorUuid: string, ipAddress: string) {
    const user = await this.prisma.user.findUnique({ where: { uuid } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.role === 'SUPER_ADMIN') {
      throw new ForbiddenException('Cannot suspend a Super Admin account');
    }
    if (user.status === 'SUSPENDED') {
      throw new BadRequestException('User is already suspended');
    }

    // STEP 8: Cancel distributor subscription before suspending
    if (user.role === 'DISTRIBUTOR') {
      const sub = await this.prisma.distributorSubscription.findUnique({
        where: { userUuid: uuid },
      });

      if (sub && (sub.status === 'ACTIVE' || sub.status === 'HALTED')) {
        const isMock =
          this.config.get<string>('PAYMENT_PROVIDER', 'mock') === 'mock';
        if (!isMock) {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const Razorpay = require('razorpay');
          const razorpay = new Razorpay({
            key_id: this.config.get<string>('RAZORPAY_KEY_ID'),
            key_secret: this.config.get<string>('RAZORPAY_KEY_SECRET'),
          });
          await razorpay.subscriptions.cancel(sub.razorpaySubscriptionId, {
            cancel_at_cycle_end: 0,
          });
        }

        const now = new Date();
        await this.prisma.distributorSubscription.update({
          where: { uuid: sub.uuid },
          data: { status: 'CANCELLED', cancelledAt: now },
        });

        await this.prisma.user.update({
          where: { uuid },
          data: { role: 'CUSTOMER', joinLinkActive: false },
        });

        // Fire-and-forget history log
        this.historyService.log({
          userUuid: user.uuid,
          event: 'SUSPEND_CANCELLED',
          notes: 'Subscription cancelled due to account suspension',
        });

        this.auditService.log({
          actorUuid,
          action: 'DISTRIBUTOR_SUBSCRIPTION_CANCELLED_ON_SUSPEND',
          metadata: { targetUserUuid: uuid },
          ipAddress,
        });
      }
    }

    const now = new Date();

    await this.prisma.user.update({
      where: { uuid },
      data: {
        status: 'SUSPENDED',
        suspendedAt: now,
        suspendedBy: actorUuid,
      },
    });

    // Delete ALL auth sessions
    await this.prisma.authSession.deleteMany({ where: { userUuid: uuid } });

    // Fire-and-forget suspension email
    const suspendedAtFormatted = now.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    this.mailService.sendSuspensionEmail(
      user.email,
      user.fullName,
      suspendedAtFormatted,
    );

    // Audit log (fire-and-forget)
    this.auditService.log({
      actorUuid,
      action: 'USER_SUSPENDED',
      metadata: { targetUserUuid: uuid },
      ipAddress,
    });

    return { message: 'User suspended successfully' };
  }

  /**
   * Reactivate a suspended user account.
   * STEP 9: If user had a cancelled distributor subscription, keep them as CUSTOMER.
   */
  async reactivateUser(uuid: string, actorUuid: string, ipAddress: string) {
    const user = await this.prisma.user.findUnique({ where: { uuid } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.status !== 'SUSPENDED') {
      throw new BadRequestException('User is not suspended');
    }

    await this.prisma.user.update({
      where: { uuid },
      data: {
        status: 'ACTIVE',
        suspendedAt: null,
        suspendedBy: null,
      },
    });

    // STEP 9: Check if user had a cancelled distributor subscription
    const sub = await this.prisma.distributorSubscription.findUnique({
      where: { userUuid: uuid },
    });

    let note: string | null = null;
    if (sub && sub.status === 'CANCELLED') {
      note =
        'Account reactivated. User must re-subscribe to restore Distributor access.';
      this.logger.log(
        `User ${uuid} reactivated as CUSTOMER — subscription was cancelled on suspend. Must re-subscribe.`,
      );
    }

    // Fire-and-forget reactivation email
    this.mailService.sendReactivationEmail(user.email, user.fullName);

    // Audit log (fire-and-forget)
    this.auditService.log({
      actorUuid,
      action: 'USER_REACTIVATED',
      metadata: { targetUserUuid: uuid },
      ipAddress,
    });

    return { message: 'User reactivated successfully', note };
  }

  /**
   * Update a user's role.
   * STEP 10: If changing FROM DISTRIBUTOR to another role, cancel their subscription.
   */
  async updateUserRole(
    uuid: string,
    dto: UpdateUserRoleDto,
    actorUuid: string,
    ipAddress: string,
  ) {
    const roleStr = dto.role as string;
    if (roleStr === 'SUPER_ADMIN') {
      throw new ForbiddenException('Cannot assign Super Admin role via API');
    }

    if (roleStr === 'DISTRIBUTOR') {
      throw new ForbiddenException(
        'Distributor role can only be granted via subscription payment. Use the subscription management panel instead.',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { uuid } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.role === 'SUPER_ADMIN') {
      throw new ForbiddenException('Cannot change role of a Super Admin');
    }

    const fromRole = user.role;

    // STEP 10: If changing FROM DISTRIBUTOR, cancel their subscription
    if (fromRole === 'DISTRIBUTOR') {
      const sub = await this.prisma.distributorSubscription.findUnique({
        where: { userUuid: uuid },
      });

      if (sub && (sub.status === 'ACTIVE' || sub.status === 'HALTED')) {
        const isMock =
          this.config.get<string>('PAYMENT_PROVIDER', 'mock') === 'mock';
        if (!isMock) {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const Razorpay = require('razorpay');
          const razorpay = new Razorpay({
            key_id: this.config.get<string>('RAZORPAY_KEY_ID'),
            key_secret: this.config.get<string>('RAZORPAY_KEY_SECRET'),
          });
          await razorpay.subscriptions.cancel(sub.razorpaySubscriptionId, {
            cancel_at_cycle_end: 0,
          });
        }

        await this.prisma.distributorSubscription.update({
          where: { uuid: sub.uuid },
          data: { status: 'CANCELLED', cancelledAt: new Date() },
        });

        await this.prisma.user.update({
          where: { uuid },
          data: { joinLinkActive: false },
        });

        // Fire-and-forget history log
        this.historyService.log({
          userUuid: user.uuid,
          event: 'ROLE_CHANGE_CANCELLED',
          notes: `Role changed from DISTRIBUTOR to ${roleStr}`,
        });

        this.auditService.log({
          actorUuid,
          action: 'DISTRIBUTOR_SUBSCRIPTION_CANCELLED_ON_ROLE_CHANGE',
          metadata: { targetUserUuid: uuid, fromRole, toRole: roleStr },
          ipAddress,
        });
      }
    }

    await this.prisma.user.update({
      where: { uuid },
      data: { role: roleStr as import('@prisma/client').UserRole },
    });

    // Audit log (fire-and-forget)
    this.auditService.log({
      actorUuid,
      action: 'USER_ROLE_CHANGED',
      metadata: { targetUserUuid: uuid, fromRole, toRole: dto.role },
      ipAddress,
    });

    return { message: 'User role updated successfully' };
  }
}
