import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { LeadStatus, Prisma } from '@prisma/client';
import QRCode from 'qrcode';
import type { UtmQueryDto } from './dto/utm-query.dto.js';
import type { DistributorUsersQueryDto } from './dto/distributor-users-query.dto.js';
import { autoGranularity, formatPeriod, generatePeriods } from '../common/utils/generate-periods.util.js';

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
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      statusGroups,
      thisMonthLeads,
      thisMonthCustomers,
      recentLeadsRaw,
      subscription,
    ] = await Promise.all([
      this.prisma.lead.groupBy({
        by: ['status'],
        where: { distributorUuid: userUuid },
        _count: { uuid: true },
      }),
      this.prisma.lead.count({
        where: {
          distributorUuid: userUuid,
          createdAt: { gte: monthStart },
        },
      }),
      this.prisma.lead.count({
        where: {
          distributorUuid: userUuid,
          status: LeadStatus.MARK_AS_CUSTOMER,
          createdAt: { gte: monthStart },
        },
      }),
      this.prisma.lead.findMany({
        where: { distributorUuid: userUuid },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          uuid: true,
          status: true,
          createdAt: true,
          user: { select: { fullName: true } },
        },
      }),
      this.prisma.distributorSubscription.findUnique({
        where: { userUuid },
        include: { plan: { select: { amount: true } } },
      }),
    ]);

    // leadsByStatus + lifetime totals derived from the same groupBy.
    const leadsByStatus = {
      new: 0,
      warm: 0,
      hot: 0,
      contacted: 0,
      followUp: 0,
      nurture: 0,
      lost: 0,
      customer: 0,
    };
    let totalLeads = 0;
    let hotLeads = 0;
    let contactedLeads = 0;
    let customers = 0;
    for (const g of statusGroups) {
      const count = g._count.uuid;
      totalLeads += count;
      switch (g.status) {
        case 'NEW':
          leadsByStatus.new = count;
          break;
        case 'WARM':
          leadsByStatus.warm = count;
          break;
        case 'HOT':
          leadsByStatus.hot = count;
          hotLeads = count;
          break;
        case 'CONTACTED':
          leadsByStatus.contacted = count;
          contactedLeads = count;
          break;
        case 'FOLLOWUP':
          leadsByStatus.followUp = count;
          break;
        case 'NURTURE':
          leadsByStatus.nurture = count;
          break;
        case 'LOST':
          leadsByStatus.lost = count;
          break;
        case 'MARK_AS_CUSTOMER':
          leadsByStatus.customer = count;
          customers = count;
          break;
      }
    }

    const conversionRate =
      totalLeads === 0
        ? 0
        : parseFloat(((customers / totalLeads) * 100).toFixed(2));

    const thisMonthConvRate =
      thisMonthLeads === 0
        ? 0
        : Math.round((thisMonthCustomers / thisMonthLeads) * 100 * 10) / 10;

    const recentLeads = recentLeadsRaw.map((l) => ({
      uuid: l.uuid,
      name: l.user?.fullName ?? '',
      status: l.status,
      createdAt: l.createdAt.toISOString(),
    }));

    const subscriptionAmount = subscription?.plan?.amount ?? 0;
    const costPerLead =
      thisMonthLeads === 0
        ? null
        : Math.round((subscriptionAmount / thisMonthLeads) * 100) / 100;

    const base = {
      totalLeads,
      hotLeads,
      contactedLeads,
      customers,
      conversionRate,
      leadsByStatus,
      thisMonth: {
        leads: thisMonthLeads,
        customers: thisMonthCustomers,
        conversionRate: thisMonthConvRate,
      },
      recentLeads,
      planValueScore: {
        leadsThisMonth: thisMonthLeads,
        subscriptionAmount,
        costPerLead,
      },
    };

    // No date range — return base only.
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

  // ─── GET analytics overview ────────────────────────────────────────────────

  /**
   * GET /distributor/analytics/overview
   * Lifetime by default; from/to narrows the pipeline + best-days + trend
   * ranges. Campaigns / geography / funnel drop-off are always lifetime
   * (they describe the distributor's full referral network, not a window).
   */
  async getAnalyticsOverview(
    userUuid: string,
    query?: { from?: string; to?: string },
  ) {
    const hasDateRange = !!(query?.from && query?.to);
    let from: Date | undefined;
    let to: Date | undefined;
    if (hasDateRange) {
      to = new Date(query!.to!);
      to.setHours(23, 59, 59, 999);
      from = new Date(query!.from!);
      from.setHours(0, 0, 0, 0);
    }

    const leadDateFilter =
      from && to ? { createdAt: { gte: from, lte: to } } : {};
    const pipelineWhere = { distributorUuid: userUuid, ...leadDateFilter };

    // For trend: if no range, default to last 30 days (same convention as
    // the wider analytics stack).
    const trendTo = to ?? new Date();
    const trendFrom =
      from ?? new Date(trendTo.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Users referred by this distributor — expressed via the 1:1
    // UserAcquisition relation (no referredByDistributorUuid field exists
    // on User; verified against prisma/schema.prisma).
    const referredUserFilter = {
      is: { acquisition: { is: { distributorUuid: userUuid } } },
    };

    const [
      pipelineGroups,
      geoGroups,
      campaigns,
      visitedJoinLink,
      registered,
      completedFunnel,
      decidedYes,
      decidedNo,
      becameDistributor,
      bestDays,
      trend,
    ] = await Promise.all([
      this.prisma.lead.groupBy({
        by: ['status'],
        where: pipelineWhere,
        _count: { uuid: true },
      }),
      this.prisma.userAcquisition.groupBy({
        by: ['country'],
        where: { distributorUuid: userUuid, country: { not: null } },
        _count: { uuid: true },
        orderBy: { _count: { uuid: 'desc' } },
        take: 10,
      }),
      this.getCampaignsFull(userUuid, from, to),
      this.prisma.userAcquisition.count({
        where: { distributorUuid: userUuid },
      }),
      this.prisma.user.count({
        where: { acquisition: { is: { distributorUuid: userUuid } } },
      }),
      this.prisma.payment.count({
        where: {
          status: 'SUCCESS',
          paymentType: 'COMMITMENT_FEE',
          user: referredUserFilter,
        },
      }),
      this.prisma.funnelProgress.count({
        where: { decisionAnswer: 'YES', user: referredUserFilter },
      }),
      this.prisma.funnelProgress.count({
        where: { decisionAnswer: 'NO', user: referredUserFilter },
      }),
      this.prisma.distributorSubscription.count({
        where: { user: referredUserFilter },
      }),
      this.getBestDays(userUuid, from, to),
      this.buildTrend(userUuid, trendFrom, trendTo),
    ]);

    let pipelineTotal = 0;
    for (const g of pipelineGroups) pipelineTotal += g._count.uuid;

    const pipelineByStatus = pipelineGroups.map((g) => ({
      status: g.status,
      count: g._count.uuid,
      percentage:
        pipelineTotal === 0
          ? 0
          : Math.round((g._count.uuid / pipelineTotal) * 100 * 10) / 10,
    }));

    const geography = geoGroups.map((g) => ({
      country: g.country ?? 'Unknown',
      count: g._count.uuid,
    }));

    return {
      pipeline: { total: pipelineTotal, byStatus: pipelineByStatus },
      campaigns,
      funnelDropOff: {
        visitedJoinLink,
        registered,
        completedFunnel,
        decidedYes,
        decidedNo,
        becameDistributor,
      },
      geography,
      bestDays,
      trend,
    };
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


  private async buildTrend(
    userUuid: string,
    from: Date,
    to: Date,
  ): Promise<Array<{ date: string; leads: number; customers: number }>> {
    const grouping = autoGranularity(from, to);

    const leads = await this.prisma.lead.findMany({
      where: { distributorUuid: userUuid, createdAt: { gte: from, lte: to } },
      select: { createdAt: true, status: true },
    });

    const leadsMap = new Map<string, number>();
    const customersMap = new Map<string, number>();

    for (const lead of leads) {
      const period = formatPeriod(lead.createdAt, grouping);
      leadsMap.set(period, (leadsMap.get(period) ?? 0) + 1);
      if (lead.status === LeadStatus.MARK_AS_CUSTOMER) {
        customersMap.set(period, (customersMap.get(period) ?? 0) + 1);
      }
    }

    const periods = generatePeriods(from, to, grouping);
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

  /**
   * Full campaign list for the analytics overview — all campaigns (no slice),
   * plus uuid / converted (lead status MARK_AS_CUSTOMER) / isActive.
   * Date range narrows the acquisition + conversion windows; when no range
   * is provided the metrics are lifetime-to-date.
   */
  private async getCampaignsFull(
    userUuid: string,
    from?: Date,
    to?: Date,
  ): Promise<
    Array<{
      uuid: string;
      name: string;
      slug: string;
      clicks: number;
      signups: number;
      converted: number;
      conversionRate: number;
      isActive: boolean;
    }>
  > {
    const campaigns = await this.prisma.campaign.findMany({
      where: { ownerUuid: userUuid, ownerType: 'DISTRIBUTOR' },
      select: {
        uuid: true,
        name: true,
        utmCampaign: true,
        isActive: true,
      },
    });

    if (campaigns.length === 0) return [];

    const results = await Promise.all(
      campaigns.map(async (campaign) => {
        const acqWhere: Prisma.UserAcquisitionWhereInput = {
          utmCampaign: campaign.utmCampaign,
          distributorUuid: userUuid,
        };
        if (from && to) {
          acqWhere.capturedAt = { gte: from, lte: to };
        }

        const acquisitions = await this.prisma.userAcquisition.findMany({
          where: acqWhere,
          select: { userUuid: true },
        });

        const clicks = acquisitions.length;
        const acquiredUserUuids = acquisitions.map((a) => a.userUuid);

        let signups = 0;
        let converted = 0;
        if (acquiredUserUuids.length > 0) {
          const [s, c] = await Promise.all([
            this.prisma.lead.count({
              where: {
                distributorUuid: userUuid,
                userUuid: { in: acquiredUserUuids },
              },
            }),
            this.prisma.lead.count({
              where: {
                distributorUuid: userUuid,
                userUuid: { in: acquiredUserUuids },
                status: LeadStatus.MARK_AS_CUSTOMER,
              },
            }),
          ]);
          signups = s;
          converted = c;
        }

        const conversionRate =
          signups > 0
            ? Math.round((converted / signups) * 100 * 10) / 10
            : 0;

        return {
          uuid: campaign.uuid,
          name: campaign.name,
          slug: campaign.utmCampaign,
          clicks,
          signups,
          converted,
          conversionRate,
          isActive: campaign.isActive,
        };
      }),
    );

    return results.sort((a, b) => b.signups - a.signups);
  }

  /**
   * Best-performing weekdays — avg leads per occurrence of each weekday
   * within the range (or lifetime). Division happens in SQL to avoid
   * loading rows into JS.
   */
  private async getBestDays(
    userUuid: string,
    from?: Date,
    to?: Date,
  ): Promise<Array<{ dayOfWeek: string; avgLeads: number }>> {
    const dateClause =
      from && to
        ? Prisma.sql`AND "createdAt" BETWEEN ${from} AND ${to}`
        : Prisma.sql``;

    const rows = await this.prisma.$queryRaw<
      Array<{ dayName: string; dayNum: number; avgLeads: string | number }>
    >(Prisma.sql`
      SELECT
        TRIM(TO_CHAR("createdAt", 'Day')) AS "dayName",
        EXTRACT(DOW FROM "createdAt")::int AS "dayNum",
        (COUNT(*)::numeric /
          GREATEST(COUNT(DISTINCT DATE_TRUNC('week', "createdAt")), 1)
        ) AS "avgLeads"
      FROM leads
      WHERE "distributorUuid" = ${userUuid}
      ${dateClause}
      GROUP BY "dayName", "dayNum"
      ORDER BY "dayNum"
    `);

    return rows.map((r) => ({
      dayOfWeek: r.dayName,
      avgLeads: Math.round(Number(r.avgLeads) * 10) / 10,
    }));
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
