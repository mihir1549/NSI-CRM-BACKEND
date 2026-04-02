import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { MailService } from '../mail/mail.service.js';
import type { UpdateUserRoleDto } from './dto/update-user-role.dto.js';

@Injectable()
export class UsersAdminService {
  private readonly logger = new Logger(UsersAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly mailService: MailService,
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

    const where: Record<string, unknown> = {};

    if (query.role) {
      where['role'] = query.role.toUpperCase();
    }
    if (query.status) {
      where['status'] = query.status.toUpperCase();
    }
    if (query.country) {
      where['country'] = query.country;
    }
    if (query.search) {
      where['OR'] = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
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
          leadAsUser: { select: { status: true } },
          payments: { where: { status: 'SUCCESS' }, select: { uuid: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    // Get total active funnel steps for progress calculation
    const totalSteps = await this.prisma.funnelStep.count({ where: { isActive: true } });

    const items = users.map((u) => ({
      uuid: u.uuid,
      fullName: u.fullName,
      email: u.email,
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

    const totalSteps = await this.prisma.funnelStep.count({ where: { isActive: true } });
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
      lessonProgressData.filter((lp) => lp.isCompleted).map((lp) => lp.lessonUuid),
    );

    const lmsProgressWithAccurate = user.enrollments.map((enrollment) => {
      const allLessons = enrollment.course.sections.flatMap((s) => s.lessons);
      const totalLessons = allLessons.length;
      const completedCount = totalLessons > 0
        ? allLessons.filter((l) => completedLessonUuids.has(l.uuid)).length
        : 0;
      const progress = totalLessons > 0
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
      role: user.role,
      status: user.status,
      country: user.country ?? null,
      createdAt: user.createdAt,
      suspendedAt: user.suspendedAt ?? null,
      phone: user.profile?.phone ?? null,
      phoneVerified: user.profile?.phoneVerifiedAt != null,
      paymentCompleted: user.funnelProgress?.paymentCompleted ?? false,
      funnelProgress: {
        completedSteps: user.funnelProgress?.stepProgress?.filter((sp) => sp.isCompleted).length ?? 0,
        totalSteps,
      },
      leadStatus: user.leadAsUser?.status ?? null,
      paymentHistory: user.payments,
      funnelStepProgress: (user.funnelProgress?.stepProgress ?? []).map((sp) => ({
        stepUuid: sp.stepUuid,
        stepType: sp.step.type,
        stepOrder: sp.step.order,
        isCompleted: sp.isCompleted,
        watchedSeconds: sp.watchedSeconds,
        completedAt: sp.completedAt ?? null,
      })),
      leadDetail,
      lmsProgress: lmsProgressWithAccurate,
      activeSessions,
    };
  }

  /**
   * Suspend a user account.
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
    this.mailService.sendSuspensionEmail(user.email, user.fullName, suspendedAtFormatted);

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

    // Fire-and-forget reactivation email
    this.mailService.sendReactivationEmail(user.email, user.fullName);

    // Audit log (fire-and-forget)
    this.auditService.log({
      actorUuid,
      action: 'USER_REACTIVATED',
      metadata: { targetUserUuid: uuid },
      ipAddress,
    });

    return { message: 'User reactivated successfully' };
  }

  /**
   * Update a user's role.
   */
  async updateUserRole(uuid: string, dto: UpdateUserRoleDto, actorUuid: string, ipAddress: string) {
    if (dto.role === 'SUPER_ADMIN') {
      throw new ForbiddenException('Cannot assign Super Admin role via API');
    }

    const user = await this.prisma.user.findUnique({ where: { uuid } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.role === 'SUPER_ADMIN') {
      throw new ForbiddenException('Cannot change role of a Super Admin');
    }

    const fromRole = user.role;

    await this.prisma.user.update({
      where: { uuid },
      data: { role: dto.role },
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
