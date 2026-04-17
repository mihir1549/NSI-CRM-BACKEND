import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { LeadStatus } from '@prisma/client';
import QRCode from 'qrcode';
import type { UtmQueryDto } from './dto/utm-query.dto.js';
import type { DistributorUsersQueryDto } from './dto/distributor-users-query.dto.js';

const FUNNEL_STAGE_LABELS: Record<string, string> = {
  REGISTERED: 'Registered',
  PHONE_VERIFIED: 'Phone Verified',
  PAYMENT_COMPLETED: 'Payment Completed',
  SAID_YES: 'Said YES',
  SAID_NO: 'Said NO',
};

const LEAD_STATUS_LABELS = {
  NEW: 'New',
  WARM: 'Warm',
  HOT: 'Hot',
  CONTACTED: 'Contacted',
  FOLLOWUP: 'Follow Up',
  NURTURE: 'Nurture',
  LOST: 'Lost',
  MARK_AS_CUSTOMER: 'Customer',
} as const;

const LEAD_TRANSITIONS = {
  NEW: [],
  WARM: [],
  HOT: ['CONTACTED', 'FOLLOWUP', 'MARK_AS_CUSTOMER', 'LOST'],
  CONTACTED: ['FOLLOWUP', 'MARK_AS_CUSTOMER', 'LOST'],
  FOLLOWUP: ['CONTACTED', 'MARK_AS_CUSTOMER', 'LOST'],
  NURTURE: [],
  LOST: [],
  MARK_AS_CUSTOMER: [],
} as const;

@Injectable()
export class DistributorService {
  private readonly logger = new Logger(DistributorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ─── GET join link ─────────────────────────────────────────────────────────

  async getJoinLink(userUuid: string) {
    const user = await this.prisma.user.findUnique({
      where: { uuid: userUuid },
      select: { distributorCode: true, joinLinkActive: true },
    });

    if (!user?.distributorCode) {
      throw new NotFoundException('No distributor code assigned yet');
    }

    const frontendUrl = this.config.get<string>(
      'FRONTEND_URL',
      'https://growithnsi.com',
    );
    const url = `${frontendUrl}/join/${user.distributorCode}`;
    const qrCode = await QRCode.toDataURL(url);

    return {
      code: user.distributorCode,
      url,
      qrCode,
      isActive: user.joinLinkActive,
    };
  }

  // ─── GET dashboard ─────────────────────────────────────────────────────────

  async getDashboard(userUuid: string, query?: { from?: string; to?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { uuid: userUuid },
      select: { distributorCode: true, joinLinkActive: true },
    });

    const [totalLeads, hotLeads, contactedLeads, customers, subscription] =
      await Promise.all([
        this.prisma.lead.count({ where: { distributorUuid: userUuid } }),
        this.prisma.lead.count({
          where: { distributorUuid: userUuid, status: LeadStatus.HOT },
        }),
        this.prisma.lead.count({
          where: { distributorUuid: userUuid, status: LeadStatus.CONTACTED },
        }),
        this.prisma.lead.count({
          where: {
            distributorUuid: userUuid,
            status: LeadStatus.MARK_AS_CUSTOMER,
          },
        }),
        this.prisma.distributorSubscription.findUnique({
          where: { userUuid },
          include: { plan: { select: { name: true, amount: true } } },
        }),
      ]);

    const conversionRate =
      totalLeads === 0
        ? 0
        : parseFloat(((customers / totalLeads) * 100).toFixed(2));

    const frontendUrl = this.config.get<string>(
      'FRONTEND_URL',
      'https://growithnsi.com',
    );
    const joinLink = user?.distributorCode
      ? {
          url: `${frontendUrl}/join/${user.distributorCode}`,
          isActive: user.joinLinkActive,
        }
      : null;

    const subscriptionData = subscription
      ? {
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
          graceDeadline: subscription.graceDeadline,
          plan: subscription.plan,
        }
      : null;

    const base = {
      totalLeads,
      hotLeads,
      contactedLeads,
      customers,
      conversionRate,
      subscription: subscriptionData,
      joinLink,
    };

    // No date range — return existing shape unchanged
    if (!query?.from || !query?.to) {
      return base;
    }

    // ── Date-range enhancements ──────────────────────────────────────────────
    const to = new Date(query.to);
    to.setHours(23, 59, 59, 999);
    const from = new Date(query.from);
    from.setHours(0, 0, 0, 0);

    const rangeMs = to.getTime() - from.getTime();
    const previousTo = new Date(from.getTime() - 1);
    const previousFrom = new Date(previousTo.getTime() - rangeMs);

    const [periodLeads, prevLeads, periodCustomers, prevCustomers] =
      await Promise.all([
        this.prisma.lead.count({
          where: {
            distributorUuid: userUuid,
            createdAt: { gte: from, lte: to },
          },
        }),
        this.prisma.lead.count({
          where: {
            distributorUuid: userUuid,
            createdAt: { gte: previousFrom, lte: previousTo },
          },
        }),
        this.prisma.lead.count({
          where: {
            distributorUuid: userUuid,
            status: LeadStatus.MARK_AS_CUSTOMER,
            createdAt: { gte: from, lte: to },
          },
        }),
        this.prisma.lead.count({
          where: {
            distributorUuid: userUuid,
            status: LeadStatus.MARK_AS_CUSTOMER,
            createdAt: { gte: previousFrom, lte: previousTo },
          },
        }),
      ]);

    const periodConvRate =
      periodLeads === 0
        ? 0
        : Math.round((periodCustomers / periodLeads) * 100 * 10) / 10;
    const prevConvRate =
      prevLeads === 0
        ? 0
        : Math.round((prevCustomers / prevLeads) * 100 * 10) / 10;

    const period = {
      from: from.toISOString(),
      to: to.toISOString(),
      leads: periodLeads,
      customers: periodCustomers,
      conversionRate: periodConvRate,
      growth: {
        leads: this.calculateGrowth(periodLeads, prevLeads),
        customers: this.calculateGrowth(periodCustomers, prevCustomers),
        conversionRate: this.calculateGrowth(periodConvRate, prevConvRate),
      },
    };

    const [trend, topCampaigns] = await Promise.all([
      this.buildTrend(userUuid, from, to),
      this.getTopCampaigns(userUuid, from, to),
    ]);

    return { ...base, period, trend, topCampaigns };
  }

  // ─── GET UTM analytics ─────────────────────────────────────────────────────

  async getUtmAnalytics(userUuid: string, query: UtmQueryDto) {
    const to = query.to ? new Date(query.to) : new Date();
    to.setHours(23, 59, 59, 999);

    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    from.setHours(0, 0, 0, 0);

    // Find leads for this distributor in date range
    const leads = await this.prisma.lead.findMany({
      where: {
        distributorUuid: userUuid,
        createdAt: { gte: from, lte: to },
      },
      select: { userUuid: true },
    });

    const userUuids = leads.map((l) => l.userUuid);

    if (userUuids.length === 0) {
      return {
        bySource: [],
        byMedium: [],
        byCampaign: [],
        total: 0,
        from: from.toISOString(),
        to: to.toISOString(),
      };
    }

    const acquisitions = await this.prisma.userAcquisition.findMany({
      where: { userUuid: { in: userUuids } },
      select: { utmSource: true, utmMedium: true, utmCampaign: true },
    });

    const sourceMap = new Map<string, number>();
    const mediumMap = new Map<string, number>();
    const campaignMap = new Map<string, number>();

    for (const acq of acquisitions) {
      const source = acq.utmSource || 'direct';
      const medium = acq.utmMedium || 'direct';
      const campaign = acq.utmCampaign || 'direct';
      sourceMap.set(source, (sourceMap.get(source) ?? 0) + 1);
      mediumMap.set(medium, (mediumMap.get(medium) ?? 0) + 1);
      campaignMap.set(campaign, (campaignMap.get(campaign) ?? 0) + 1);
    }

    return {
      bySource: Array.from(sourceMap.entries())
        .sort(([, a], [, b]) => b - a)
        .map(([source, leads]) => ({ source, leads })),
      byMedium: Array.from(mediumMap.entries())
        .sort(([, a], [, b]) => b - a)
        .map(([medium, leads]) => ({ medium, leads })),
      byCampaign: Array.from(campaignMap.entries())
        .sort(([, a], [, b]) => b - a)
        .map(([campaign, leads]) => ({ campaign, leads })),
      total: userUuids.length,
      from: from.toISOString(),
      to: to.toISOString(),
    };
  }

  // ─── Users analytics ───────────────────────────────────────────────────────

  async getUsersAnalytics(
    distributorUuid: string,
    query?: { from?: string; to?: string },
  ) {
    const dateFilter =
      query?.from && query?.to
        ? {
            createdAt: {
              gte: new Date(new Date(query.from).setHours(0, 0, 0, 0)),
              lte: new Date(new Date(query.to).setHours(23, 59, 59, 999)),
            },
          }
        : {};

    // Collect all user UUIDs referred by this distributor
    const leads = await this.prisma.lead.findMany({
      where: { distributorUuid, ...dateFilter },
      select: { userUuid: true, status: true },
    });

    const totalUsers = leads.length;
    const userUuids = leads.map((l) => l.userUuid);

    if (totalUsers === 0) {
      return {
        totalUsers: 0,
        paidUsers: 0,
        freeUsers: 0,
        hotLeads: 0,
        customers: 0,
        conversionRate: 0,
        funnelDropOff: {
          registered: 0,
          phoneVerified: 0,
          paymentCompleted: 0,
          saidYes: 0,
          saidNo: 0,
        },
      };
    }

    const hotLeads = leads.filter((l) => l.status === LeadStatus.HOT).length;
    const customers = leads.filter(
      (l) => l.status === LeadStatus.MARK_AS_CUSTOMER,
    ).length;
    const conversionRate = parseFloat(((customers / totalUsers) * 100).toFixed(2));

    const [paidCount, funnelProgressRecords] = await Promise.all([
      this.prisma.payment
        .groupBy({
          by: ['userUuid'],
          where: { userUuid: { in: userUuids }, status: 'SUCCESS' },
        })
        .then((rows) => rows.length),
      this.prisma.funnelProgress.findMany({
        where: { userUuid: { in: userUuids } },
        select: {
          phoneVerified: true,
          paymentCompleted: true,
          decisionAnswer: true,
        },
      }),
    ]);

    let phoneVerified = 0;
    let paymentCompleted = 0;
    let saidYes = 0;
    let saidNo = 0;

    for (const fp of funnelProgressRecords) {
      if (fp.phoneVerified) phoneVerified++;
      if (fp.paymentCompleted) paymentCompleted++;
      if (fp.decisionAnswer === 'YES') saidYes++;
      if (fp.decisionAnswer === 'NO') saidNo++;
    }

    return {
      totalUsers,
      paidUsers: paidCount,
      freeUsers: totalUsers - paidCount,
      hotLeads,
      customers,
      conversionRate,
      funnelDropOff: {
        registered: totalUsers,
        phoneVerified,
        paymentCompleted,
        saidYes,
        saidNo,
      },
    };
  }

  // ─── List referred users ────────────────────────────────────────────────────

  async listUsers(distributorUuid: string, query: DistributorUsersQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    // Build AND conditions — always scoped to this distributor's leads
    const andConditions: Record<string, unknown>[] = [
      { leadAsUser: { distributorUuid } },
    ];

    if (query.search) {
      andConditions.push({
        OR: [
          { fullName: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }

    if (query.funnelStage) {
      andConditions.push(this.buildFunnelStageFilter(query.funnelStage));
    }

    if (query.from && query.to) {
      const from = new Date(query.from);
      from.setHours(0, 0, 0, 0);
      const to = new Date(query.to);
      to.setHours(23, 59, 59, 999);
      andConditions.push({ createdAt: { gte: from, lte: to } });
    }

    const where = { AND: andConditions };

    const [users, total, totalSteps] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          leadAsUser: { select: { status: true } },
          profile: { select: { phone: true } },
          funnelProgress: {
            select: {
              phoneVerified: true,
              paymentCompleted: true,
              decisionAnswer: true,
              stepProgress: { where: { isCompleted: true } },
            },
          },
          payments: {
            where: { status: 'SUCCESS' },
            select: { uuid: true },
            take: 1,
          },
        },
      }),
      this.prisma.user.count({ where }),
      this.prisma.funnelStep.count({ where: { isActive: true } }),
    ]);

    const items = users.map((u) => {
      const fp = u.funnelProgress;
      const funnelStageKey = this.computeFunnelStage(fp ?? null);
      const funnelStageLabel = FUNNEL_STAGE_LABELS[funnelStageKey];
      const leadStatus = u.leadAsUser?.status ?? 'NEW';

      return {
        uuid: u.uuid,
        fullName: u.fullName,
        email: u.email,
        phone: u.profile?.phone ?? null,
        country: u.country ?? null,
        avatarUrl: u.avatarUrl ?? null,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt,
        leadStatus,
        displayLeadStatus:
          LEAD_STATUS_LABELS[leadStatus as keyof typeof LEAD_STATUS_LABELS] ??
          leadStatus,
        paymentStatus: u.payments.length > 0 ? 'Paid' : 'Free',
        funnelStage: funnelStageKey,
        funnelStageLabel,
        funnelProgress: {
          completedSteps: fp?.stepProgress?.length ?? 0,
          totalSteps,
          phoneVerified: fp?.phoneVerified ?? false,
          paymentCompleted: fp?.paymentCompleted ?? false,
          decisionAnswer: fp?.decisionAnswer ?? null,
        },
      };
    });

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── User detail ────────────────────────────────────────────────────────────

  async getUserDetail(distributorUuid: string, targetUserUuid: string) {
    // Security: confirm this user belongs to this distributor
    const lead = await this.prisma.lead.findFirst({
      where: { userUuid: targetUserUuid, distributorUuid },
      include: {
        activities: {
          include: { actor: { select: { fullName: true } } },
          orderBy: { createdAt: 'desc' },
        },
        nurtureEnrollment: true,
      },
    });

    if (!lead) {
      throw new NotFoundException('User not found');
    }

    const [user, funnelProgress, payments, enrollments, totalSteps] =
      await Promise.all([
        this.prisma.user.findUnique({
          where: { uuid: targetUserUuid },
          include: { profile: { select: { phone: true } } },
        }),
        this.prisma.funnelProgress.findUnique({
          where: { userUuid: targetUserUuid },
          include: {
            stepProgress: {
              include: { step: { include: { content: true } } },
              orderBy: { createdAt: 'asc' },
            },
          },
        }),
        this.prisma.payment.findMany({
          where: { userUuid: targetUserUuid },
          orderBy: { createdAt: 'desc' },
          select: {
            uuid: true,
            amount: true,
            finalAmount: true,
            status: true,
            paymentType: true,
            createdAt: true,
          },
        }),
        this.prisma.courseEnrollment.findMany({
          where: { userUuid: targetUserUuid },
          include: {
            course: {
              include: {
                sections: { include: { lessons: { select: { uuid: true } } } },
              },
            },
          },
          orderBy: { enrolledAt: 'asc' },
        }),
        this.prisma.funnelStep.count({ where: { isActive: true } }),
      ]);

    if (!user) throw new NotFoundException('User not found');

    // Build LMS progress
    const allLessonUuids = enrollments.flatMap((e) =>
      e.course.sections.flatMap((s) => s.lessons.map((l) => l.uuid)),
    );
    const completedLessonProgress =
      allLessonUuids.length > 0
        ? await this.prisma.lessonProgress.findMany({
            where: {
              userUuid: targetUserUuid,
              isCompleted: true,
              lessonUuid: { in: allLessonUuids },
            },
            select: { lessonUuid: true },
          })
        : [];
    const completedLessonSet = new Set(
      completedLessonProgress.map((lp) => lp.lessonUuid),
    );

    const lmsProgress = enrollments.map((e) => {
      const courseLessons = e.course.sections.flatMap((s) =>
        s.lessons.map((l) => l.uuid),
      );
      return {
        courseUuid: e.courseUuid,
        courseTitle: e.course.title,
        enrolledAt: e.enrolledAt,
        completedAt: e.completedAt ?? null,
        certificateUrl: e.certificateUrl ?? null,
        completedLessons: courseLessons.filter((id) =>
          completedLessonSet.has(id),
        ).length,
        totalLessons: courseLessons.length,
      };
    });

    // Nurture enrollment
    const nurture = lead.nurtureEnrollment;
    const nurtureEnrollment = nurture
      ? {
          currentDay: nurture.day7SentAt
            ? 7
            : nurture.day3SentAt
              ? 3
              : nurture.day1SentAt
                ? 1
                : 0,
          completedAt:
            nurture.status === 'COMPLETED' ? nurture.updatedAt : null,
        }
      : null;

    // Funnel progress shape
    const fp = funnelProgress;
    const funnelProgressData = fp
      ? {
          completedSteps: fp.stepProgress.filter((sp) => sp.isCompleted).length,
          totalSteps,
          phoneVerified: fp.phoneVerified,
          paymentCompleted: fp.paymentCompleted,
          decisionAnswer: fp.decisionAnswer ?? null,
          decisionAnsweredAt: fp.decisionAnsweredAt ?? null,
          stepProgress: fp.stepProgress.map((sp) => ({
            stepUuid: sp.stepUuid,
            stepTitle: sp.step.content?.title ?? null,
            stepType: sp.step.type,
            isCompleted: sp.isCompleted,
            completedAt: sp.completedAt ?? null,
            watchedSeconds: sp.watchedSeconds,
          })),
        }
      : null;

    // Activity log
    const activityLog = lead.activities.map((a) => ({
      uuid: a.uuid,
      action: a.action,
      fromStatus: a.fromStatus ?? null,
      toStatus: a.toStatus ?? null,
      notes: a.notes ?? null,
      followupAt: a.followupAt ?? null,
      actorName: a.actor.fullName,
      createdAt: a.createdAt,
    }));

    return {
      uuid: user.uuid,
      fullName: user.fullName,
      email: user.email,
      phone: user.profile?.phone ?? null,
      country: user.country ?? null,
      avatarUrl: user.avatarUrl ?? null,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      lead: {
        uuid: lead.uuid,
        status: lead.status,
        displayStatus:
          LEAD_STATUS_LABELS[lead.status as keyof typeof LEAD_STATUS_LABELS] ??
          lead.status,
        availableActions:
          LEAD_TRANSITIONS[lead.status as keyof typeof LEAD_TRANSITIONS] ?? [],
        nurtureEnrollment,
      },
      funnelProgress: funnelProgressData,
      paymentHistory: payments,
      lmsProgress,
      activityLog,
    };
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private buildFunnelStageFilter(stage: string): Record<string, unknown> {
    switch (stage) {
      case 'REGISTERED':
        return {
          OR: [
            { funnelProgress: { is: null } },
            {
              funnelProgress: {
                is: { phoneVerified: false, paymentCompleted: false },
              },
            },
          ],
        };
      case 'PHONE_VERIFIED':
        return {
          funnelProgress: {
            is: { phoneVerified: true, paymentCompleted: false },
          },
        };
      case 'PAYMENT_COMPLETED':
        return {
          funnelProgress: {
            is: { paymentCompleted: true, decisionAnswer: null },
          },
        };
      case 'SAID_YES':
        return { funnelProgress: { is: { decisionAnswer: 'YES' } } };
      case 'SAID_NO':
        return { funnelProgress: { is: { decisionAnswer: 'NO' } } };
      default:
        return {};
    }
  }

  private computeFunnelStage(
    fp: {
      phoneVerified: boolean;
      paymentCompleted: boolean;
      decisionAnswer: string | null;
    } | null,
  ): string {
    if (!fp || !fp.phoneVerified) return 'REGISTERED';
    if (fp.decisionAnswer)
      return fp.decisionAnswer === 'YES' ? 'SAID_YES' : 'SAID_NO';
    if (!fp.paymentCompleted) return 'PHONE_VERIFIED';
    return 'PAYMENT_COMPLETED';
  }

  private calculateGrowth(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100 * 10) / 10;
  }

  private getGrouping(from: Date, to: Date): 'day' | 'week' | 'month' {
    const days = Math.ceil(
      (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (days <= 30) return 'day';
    if (days <= 180) return 'week';
    return 'month';
  }

  private formatPeriod(date: Date, grouping: 'day' | 'week' | 'month'): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    if (grouping === 'day') {
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }
    if (grouping === 'week') {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
      d.setDate(diff);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
  }

  private generatePeriods(
    from: Date,
    to: Date,
    grouping: 'day' | 'week' | 'month',
  ): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    const cursor = new Date(from);

    while (cursor <= to) {
      const label = this.formatPeriod(cursor, grouping);
      if (!seen.has(label)) {
        seen.add(label);
        result.push(label);
      }
      if (grouping === 'day') {
        cursor.setDate(cursor.getDate() + 1);
      } else if (grouping === 'week') {
        cursor.setDate(cursor.getDate() + 7);
      } else {
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }

    return result;
  }

  private async buildTrend(
    userUuid: string,
    from: Date,
    to: Date,
  ): Promise<Array<{ date: string; leads: number; customers: number }>> {
    const grouping = this.getGrouping(from, to);

    const leads = await this.prisma.lead.findMany({
      where: { distributorUuid: userUuid, createdAt: { gte: from, lte: to } },
      select: { createdAt: true, status: true },
    });

    const leadsMap = new Map<string, number>();
    const customersMap = new Map<string, number>();

    for (const lead of leads) {
      const period = this.formatPeriod(lead.createdAt, grouping);
      leadsMap.set(period, (leadsMap.get(period) ?? 0) + 1);
      if (lead.status === LeadStatus.MARK_AS_CUSTOMER) {
        customersMap.set(period, (customersMap.get(period) ?? 0) + 1);
      }
    }

    const periods = this.generatePeriods(from, to, grouping);
    return periods.map((p) => ({
      date: p,
      leads: leadsMap.get(p) ?? 0,
      customers: customersMap.get(p) ?? 0,
    }));
  }

  private async getTopCampaigns(
    userUuid: string,
    from?: Date,
    to?: Date,
  ): Promise<
    Array<{
      name: string;
      slug: string;
      clicks: number;
      signups: number;
      conversionRate: number;
    }>
  > {
    const campaigns = await this.prisma.campaign.findMany({
      where: { ownerUuid: userUuid, ownerType: 'DISTRIBUTOR' },
      select: { uuid: true, name: true, utmCampaign: true },
    });

    if (campaigns.length === 0) return [];

    const results = await Promise.all(
      campaigns.map(async (campaign) => {
        const acqWhere: Record<string, unknown> = {
          utmCampaign: campaign.utmCampaign,
          distributorUuid: userUuid,
        };
        if (from && to) {
          acqWhere['capturedAt'] = { gte: from, lte: to };
        }

        const acquisitions = await this.prisma.userAcquisition.findMany({
          where: acqWhere,
          select: { userUuid: true },
        });

        const clicks = acquisitions.length;
        const acquiredUserUuids = acquisitions.map((a) => a.userUuid);

        const signups =
          acquiredUserUuids.length > 0
            ? await this.prisma.lead.count({
                where: {
                  distributorUuid: userUuid,
                  userUuid: { in: acquiredUserUuids },
                },
              })
            : 0;

        const conversionRate =
          clicks > 0 ? Math.round((signups / clicks) * 100 * 10) / 10 : 0;

        return {
          name: campaign.name,
          slug: campaign.utmCampaign,
          clicks,
          signups,
          conversionRate,
        };
      }),
    );

    return results.sort((a, b) => b.signups - a.signups).slice(0, 5);
  }

  // ─── Public: resolve join code ─────────────────────────────────────────────

  async resolveJoinCode(code: string) {
    const user = await this.prisma.user.findFirst({
      where: { distributorCode: { equals: code, mode: 'insensitive' } },
      select: {
        uuid: true,
        fullName: true,
        distributorCode: true,
        joinLinkActive: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Invalid referral code');
    }
    if (!user.joinLinkActive) {
      throw new NotFoundException('This referral link is no longer active');
    }

    return {
      distributorUuid: user.uuid,
      fullName: user.fullName,
      code: user.distributorCode,
      isActive: user.joinLinkActive,
    };
  }
}
