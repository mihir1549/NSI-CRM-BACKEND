import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AnalyticsQueryDto } from './dto/analytics-query.dto.js';
import { autoGranularity, formatPeriod, generatePeriods } from '../common/utils/generate-periods.util.js';

@Injectable()
export class AnalyticsAdminService {
  private readonly MAX_RANGE_DAYS = 1825; // 5 years

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Parse and validate the date range from the query DTO.
   * Returns { from, to, previousFrom, previousTo }.
   */
  private parseDateRange(dto: AnalyticsQueryDto): {
    from: Date;
    to: Date;
    previousFrom: Date;
    previousTo: Date;
  } {
    const to = dto.to ? new Date(dto.to) : new Date();
    to.setHours(23, 59, 59, 999);

    const from = dto.from
      ? new Date(dto.from)
      : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    from.setHours(0, 0, 0, 0);

    if (from > to) {
      throw new BadRequestException('from date must be before to date');
    }

    const days = Math.ceil(
      (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (days > this.MAX_RANGE_DAYS) {
      throw new BadRequestException('Maximum date range is 5 years');
    }

    const rangeMs = to.getTime() - from.getTime();
    const previousTo = new Date(from.getTime() - 1);
    const previousFrom = new Date(previousTo.getTime() - rangeMs);

    return { from, to, previousFrom, previousTo };
  }

  /**
   * Smart date grouping: day / week / month based on range size.
   */

  /**
   * Calculate growth percentage compared to previous period, rounded to 1 decimal.
   * Returns 100 when previous is 0 and current > 0; returns 0 when both are 0.
   */
  private calculateGrowth(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100 * 10) / 10;
  }

  /**
   * GET /api/v1/admin/analytics/dashboard
   */
  async getDashboard(dto: AnalyticsQueryDto) {
    const hasDateRange = !!(dto?.from && dto?.to);
    const { from, to, previousFrom, previousTo } = this.parseDateRange(dto);

    // ─── Batch 1: Date-scoped queries (preserved for backward-compat overview) ─
    const [
      totalUsers,
      prevTotalUsers,
      hotLeads,
      prevHotLeads,
      customers,
      prevCustomers,
      distributors,
      prevDistributors,
      phoneVerifiedCount,
      paymentsCompletedCount,
      decisionYesCount,
      decisionNoCount,
      funnelRegistered,
      funnelEmailVerified,
      funnelPhoneVerified,
      funnelPaymentDone,
      funnelDecisionYes,
      deviceGroups,
      browserGroups,
      decidedYesLeads,
      decidedNoLeads,
    ] = await Promise.all([
      this.prisma.user.count({ where: { createdAt: { gte: from, lte: to } } }),
      this.prisma.user.count({
        where: { createdAt: { gte: previousFrom, lte: previousTo } },
      }),
      this.prisma.lead.count({
        where: { status: 'HOT', updatedAt: { gte: from, lte: to } },
      }),
      this.prisma.lead.count({
        where: {
          status: 'HOT',
          updatedAt: { gte: previousFrom, lte: previousTo },
        },
      }),
      this.prisma.user.count({
        where: { role: 'CUSTOMER', createdAt: { gte: from, lte: to } },
      }),
      this.prisma.user.count({
        where: {
          role: 'CUSTOMER',
          createdAt: { gte: previousFrom, lte: previousTo },
        },
      }),
      this.prisma.user.count({
        where: { role: 'DISTRIBUTOR', createdAt: { gte: from, lte: to } },
      }),
      this.prisma.user.count({
        where: {
          role: 'DISTRIBUTOR',
          createdAt: { gte: previousFrom, lte: previousTo },
        },
      }),
      this.prisma.userProfile.count({
        where: { phoneVerifiedAt: { not: null, gte: from, lte: to } },
      }),
      this.prisma.funnelProgress.count({
        where: { paymentCompleted: true, updatedAt: { gte: from, lte: to } },
      }),
      this.prisma.funnelProgress.count({
        where: {
          decisionAnswer: 'YES',
          decisionAnsweredAt: { gte: from, lte: to },
        },
      }),
      this.prisma.funnelProgress.count({
        where: {
          decisionAnswer: 'NO',
          decisionAnsweredAt: { gte: from, lte: to },
        },
      }),
      this.prisma.user.count({ where: { createdAt: { gte: from, lte: to } } }),
      this.prisma.user.count({
        where: { emailVerified: true, createdAt: { gte: from, lte: to } },
      }),
      this.prisma.userProfile.count({
        where: {
          phoneVerifiedAt: { not: null },
          user: { createdAt: { gte: from, lte: to } },
        },
      }),
      this.prisma.funnelProgress.count({
        where: {
          paymentCompleted: true,
          user: { createdAt: { gte: from, lte: to } },
        },
      }),
      this.prisma.funnelProgress.count({
        where: {
          decisionAnswer: 'YES',
          user: { createdAt: { gte: from, lte: to } },
        },
      }),
      this.prisma.userAcquisition.groupBy({
        by: ['deviceType'],
        _count: { deviceType: true },
        where: { capturedAt: { gte: from, lte: to } },
        orderBy: { _count: { deviceType: 'desc' } },
      }),
      this.prisma.userAcquisition.groupBy({
        by: ['browser'],
        _count: { browser: true },
        where: { capturedAt: { gte: from, lte: to } },
        orderBy: { _count: { browser: 'desc' } },
      }),
      this.prisma.lead.count({
        where: {
          status: { in: ['HOT', 'CONTACTED', 'FOLLOWUP', 'MARK_AS_CUSTOMER'] },
          createdAt: { gte: from, lte: to },
        },
      }),
      this.prisma.lead.count({
        where: { status: 'NURTURE', createdAt: { gte: from, lte: to } },
      }),
    ]);

    // ─── Batch 2: Lifetime totals — always unfiltered ─────────────────────────
    const [
      lifetimeUsers,
      lifetimeLeads,
      lifetimeCustomers,
      lifetimeRevenueAgg,
      lifetimeDistributors,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.lead.count(),
      this.prisma.lead.count({ where: { status: 'MARK_AS_CUSTOMER' } }),
      this.prisma.payment.aggregate({
        _sum: { finalAmount: true },
        where: { status: 'SUCCESS' },
      }),
      this.prisma.user.count({ where: { role: 'DISTRIBUTOR' } }),
    ]);
    const lifetimeRevenue = lifetimeRevenueAgg._sum.finalAmount ?? 0;

    // ─── Batch 3: Period comparison — only when from/to explicitly provided ───
    type PeriodGrowth = {
      users: number;
      leads: number;
      customers: number;
      revenue: number;
      distributors: number;
    };
    type PeriodResult = {
      from: string;
      to: string;
      users: number;
      leads: number;
      customers: number;
      revenue: number;
      distributors: number;
      growth: PeriodGrowth;
    };
    let period: PeriodResult | null = null;

    if (hasDateRange) {
      const [
        pUsers,
        prevPUsers,
        pLeads,
        prevPLeads,
        pCustomers,
        prevPCustomers,
        pRevenueAgg,
        prevPRevenueAgg,
        pDistributors,
        prevPDistributors,
      ] = await Promise.all([
        this.prisma.user.count({
          where: { createdAt: { gte: from, lte: to } },
        }),
        this.prisma.user.count({
          where: { createdAt: { gte: previousFrom, lte: previousTo } },
        }),
        this.prisma.lead.count({
          where: { createdAt: { gte: from, lte: to } },
        }),
        this.prisma.lead.count({
          where: { createdAt: { gte: previousFrom, lte: previousTo } },
        }),
        this.prisma.lead.count({
          where: {
            status: 'MARK_AS_CUSTOMER',
            createdAt: { gte: from, lte: to },
          },
        }),
        this.prisma.lead.count({
          where: {
            status: 'MARK_AS_CUSTOMER',
            createdAt: { gte: previousFrom, lte: previousTo },
          },
        }),
        this.prisma.payment.aggregate({
          _sum: { finalAmount: true },
          where: { status: 'SUCCESS', createdAt: { gte: from, lte: to } },
        }),
        this.prisma.payment.aggregate({
          _sum: { finalAmount: true },
          where: {
            status: 'SUCCESS',
            createdAt: { gte: previousFrom, lte: previousTo },
          },
        }),
        this.prisma.user.count({
          where: { role: 'DISTRIBUTOR', createdAt: { gte: from, lte: to } },
        }),
        this.prisma.user.count({
          where: {
            role: 'DISTRIBUTOR',
            createdAt: { gte: previousFrom, lte: previousTo },
          },
        }),
      ]);

      const pRevSum = pRevenueAgg._sum.finalAmount ?? 0;
      const prevPRevSum = prevPRevenueAgg._sum.finalAmount ?? 0;

      period = {
        from: from.toISOString(),
        to: to.toISOString(),
        users: pUsers,
        leads: pLeads,
        customers: pCustomers,
        revenue: pRevSum,
        distributors: pDistributors,
        growth: {
          users: this.calculateGrowth(pUsers, prevPUsers),
          leads: this.calculateGrowth(pLeads, prevPLeads),
          customers: this.calculateGrowth(pCustomers, prevPCustomers),
          revenue: this.calculateGrowth(pRevSum, prevPRevSum),
          distributors: this.calculateGrowth(pDistributors, prevPDistributors),
        },
      };
    }

    // ─── Device breakdown ─────────────────────────────────────────────────────
    const deviceCounts = { mobile: 0, desktop: 0, tablet: 0 };
    for (const g of deviceGroups) {
      const type = (g.deviceType ?? '').toLowerCase();
      if (type === 'mobile') deviceCounts.mobile = g._count.deviceType;
      else if (type === 'desktop') deviceCounts.desktop = g._count.deviceType;
      else if (type === 'tablet') deviceCounts.tablet = g._count.deviceType;
    }
    const devices = deviceGroups.length > 0 ? deviceCounts : { mobile: 0, desktop: 0, tablet: 0 };

    // ─── Browser breakdown (top 3 + Other) ───────────────────────────────────
    const totalBrowserCount = browserGroups.reduce(
      (sum, g) => sum + g._count.browser,
      0,
    );
    let topBrowsers: Array<{ browser: string; percentage: number }> = [];
    if (browserGroups.length > 0 && totalBrowserCount > 0) {
      const top3 = browserGroups.slice(0, 3).map((g) => ({
        browser: g.browser ?? 'Unknown',
        percentage:
          Math.round((g._count.browser / totalBrowserCount) * 1000) / 10,
      }));
      const top3Total = top3.reduce((sum, b) => sum + b.percentage, 0);
      const otherPct = Math.round((100 - top3Total) * 10) / 10;
      topBrowsers =
        otherPct > 0
          ? [...top3, { browser: 'Other', percentage: otherPct }]
          : top3;
    }

    // ─── Funnel summary ───────────────────────────────────────────────────────
    const overallConversionRate =
      funnelRegistered > 0
        ? Math.round((decidedYesLeads / funnelRegistered) * 100 * 10) / 10
        : 0;
    const funnelSummary = {
      totalFunnelStarts: funnelRegistered,
      completedPayment: funnelPaymentDone,
      decidedYes: decidedYesLeads,
      decidedNo: decidedNoLeads,
      overallConversionRate,
    };

    const totalDecisions = decisionYesCount + decisionNoCount;
    const yesPercent =
      totalDecisions > 0
        ? parseFloat(((decisionYesCount / totalDecisions) * 100).toFixed(1))
        : 0;

    return {
      // New top-level lifetime fields (always all-time, no date filter)
      totalUsers: lifetimeUsers,
      totalLeads: lifetimeLeads,
      totalCustomers: lifetimeCustomers,
      totalRevenue: lifetimeRevenue,
      totalDistributors: lifetimeDistributors,
      // Period comparison (null when no from/to params)
      period,
      // Existing fields preserved for backward compatibility
      overview: {
        totalUsers,
        totalUsersGrowth: this.calculateGrowth(totalUsers, prevTotalUsers),
        phoneVerified: phoneVerifiedCount,
        paymentsCompleted: paymentsCompletedCount,
        hotLeads,
        hotLeadsGrowth: this.calculateGrowth(hotLeads, prevHotLeads),
        customers,
        customersGrowth: this.calculateGrowth(customers, prevCustomers),
        distributors,
        distributorsGrowth: this.calculateGrowth(
          distributors,
          prevDistributors,
        ),
      },
      decisionSplit: {
        yes: decisionYesCount,
        no: decisionNoCount,
        yesPercent,
      },
      funnelStages: [
        { stage: 'Registered', count: funnelRegistered },
        { stage: 'Email Verified', count: funnelEmailVerified },
        { stage: 'Phone Verified', count: funnelPhoneVerified },
        { stage: 'Payment Done', count: funnelPaymentDone },
        { stage: 'Decision YES', count: funnelDecisionYes },
      ],
      devices,
      topBrowsers,
      funnelSummary,
    };
  }

  /**
   * GET /api/v1/admin/analytics/funnel
   * When no from/to params are provided, returns all-time data (no date filter).
   * When from/to are provided, filters by user.createdAt within that range.
   */
  async getFunnelAnalytics(dto: AnalyticsQueryDto) {
    const hasDateRange = !!(dto?.from && dto?.to);

    let from: Date | undefined;
    let to: Date | undefined;
    let grouping: 'daily' | 'weekly' | 'monthly' | null = null;

    if (hasDateRange) {
      const range = this.parseDateRange(dto);
      from = range.from;
      to = range.to;
      grouping = autoGranularity(from, to);
    }

    // Build optional date filter for user.createdAt
    const createdAtFilter =
      from && to ? { gte: from, lte: to } : undefined;
    const userDateFilter = createdAtFilter
      ? { user: { createdAt: createdAtFilter } }
      : {};

    const [registered, emailVerified, phoneVerified, paymentDone, decisionYes] =
      await Promise.all([
        this.prisma.user.count({
          where: createdAtFilter ? { createdAt: createdAtFilter } : {},
        }),
        this.prisma.user.count({
          where: {
            emailVerified: true,
            ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
          },
        }),
        this.prisma.userProfile.count({
          where: {
            phoneVerifiedAt: { not: null },
            ...userDateFilter,
          },
        }),
        this.prisma.funnelProgress.count({
          where: {
            paymentCompleted: true,
            ...userDateFilter,
          },
        }),
        this.prisma.funnelProgress.count({
          where: {
            decisionAnswer: 'YES',
            ...userDateFilter,
          },
        }),
      ]);

    const stageCounts = [
      registered,
      emailVerified,
      phoneVerified,
      paymentDone,
      decisionYes,
    ];
    const stageNames = [
      'Registered',
      'Email Verified',
      'Phone Verified',
      'Payment Done',
      'Decision YES',
    ];

    const stages = stageNames.map((stage, i) => {
      const count = stageCounts[i];
      const prevCount = i === 0 ? 0 : stageCounts[i - 1];
      const dropoffFromPrevious = i === 0 ? 0 : prevCount - count;
      const dropoffPercent =
        i === 0 || prevCount === 0
          ? 0
          : parseFloat((((prevCount - count) / prevCount) * 100).toFixed(1));
      const conversionFromStart =
        registered === 0
          ? 0
          : parseFloat(((count / registered) * 100).toFixed(1));

      return {
        stage,
        count,
        dropoffFromPrevious,
        dropoffPercent,
        conversionFromStart,
      };
    });

    return {
      period: {
        from: from?.toISOString() ?? null,
        to: to?.toISOString() ?? null,
      },
      grouping: grouping ? (grouping === 'daily' ? 'day' : grouping === 'weekly' ? 'week' : 'month') : null,
      stages,
    };
  }

  /**
   * GET /api/v1/admin/analytics/revenue
   */
  async getRevenueAnalytics(dto: AnalyticsQueryDto) {
    const { from, to, previousFrom, previousTo } = this.parseDateRange(dto);
    const grouping = autoGranularity(from, to);

    const [currentPayments, previousPayments] = await Promise.all([
      this.prisma.payment.findMany({
        where: { status: 'SUCCESS', createdAt: { gte: from, lte: to } },
        select: {
          finalAmount: true,
          paymentType: true,
          createdAt: true,
          user: { select: { country: true } },
        },
      }),
      this.prisma.payment.findMany({
        where: {
          status: 'SUCCESS',
          createdAt: { gte: previousFrom, lte: previousTo },
        },
        select: { finalAmount: true },
      }),
    ]);

    const totalRevenue = currentPayments.reduce(
      (sum, p) => sum + p.finalAmount,
      0,
    );
    const prevRevenue = previousPayments.reduce(
      (sum, p) => sum + p.finalAmount,
      0,
    );
    const totalRevenueGrowth = this.calculateGrowth(totalRevenue, prevRevenue);

    // By type
    const byType = {
      commitmentFee: 0,
      lmsCourse: 0,
      distributorSubscription: 0,
    };
    for (const p of currentPayments) {
      if (p.paymentType === 'COMMITMENT_FEE')
        byType.commitmentFee += p.finalAmount;
      else if (p.paymentType === 'LMS_COURSE')
        byType.lmsCourse += p.finalAmount;
      else if (p.paymentType === 'DISTRIBUTOR_SUB')
        byType.distributorSubscription += p.finalAmount;
    }

    // By country
    const countryMap = new Map<string, number>();
    for (const p of currentPayments) {
      const country = p.user.country ?? 'Unknown';
      countryMap.set(country, (countryMap.get(country) ?? 0) + p.finalAmount);
    }
    const byCountry = Array.from(countryMap.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([country, revenue]) => ({ country, revenue }));

    // Chart: group by period
    const chartMap = new Map<string, number>();
    for (const p of currentPayments) {
      const period = formatPeriod(p.createdAt, grouping);
      chartMap.set(period, (chartMap.get(period) ?? 0) + p.finalAmount);
    }
    
    const allPeriods = generatePeriods(from, to, grouping);
    const chart = allPeriods.map((period) => ({
      period,
      revenue: chartMap.get(period) ?? 0,
    }));

    return {
      totalRevenue,
      totalRevenueGrowth,
      byType,
      byCountry,
      grouping: grouping === 'daily' ? 'day' : grouping === 'weekly' ? 'week' : 'month',
      chart,
    };
  }

  /**
   * GET /api/v1/admin/analytics/leads
   */
  async getLeadsAnalytics(dto: AnalyticsQueryDto) {
    const { from, to } = this.parseDateRange(dto);
    const grouping = autoGranularity(from, to);

    const [allLeads, todayFollowupsRaw] = await Promise.all([
      this.prisma.lead.findMany({
        where: { createdAt: { gte: from, lte: to } },
        select: { status: true, distributorUuid: true, createdAt: true },
      }),
      this.prisma.leadActivity.findMany({
        where: {
          action: 'FOLLOWUP_SCHEDULED',
          followupAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lte: new Date(new Date().setHours(23, 59, 59, 999)),
          },
        },
        select: { leadUuid: true },
        distinct: ['leadUuid'],
      }),
    ]);

    const byStatus = {
      new: 0,
      warm: 0,
      hot: 0,
      contacted: 0,
      followup: 0,
      nurture: 0,
      lost: 0,
      converted: 0,
    };
    const bySource = { direct: 0, viaDistributor: 0 };

    for (const lead of allLeads) {
      switch (lead.status) {
        case 'NEW':
          byStatus.new++;
          break;
        case 'WARM':
          byStatus.warm++;
          break;
        case 'HOT':
          byStatus.hot++;
          break;
        case 'CONTACTED':
          byStatus.contacted++;
          break;
        case 'FOLLOWUP':
          byStatus.followup++;
          break;
        case 'NURTURE':
          byStatus.nurture++;
          break;
        case 'LOST':
          byStatus.lost++;
          break;
        case 'MARK_AS_CUSTOMER':
          byStatus.converted++;
          break;
      }
      if (lead.distributorUuid) {
        bySource.viaDistributor++;
      } else {
        bySource.direct++;
      }
    }

    // Chart: new leads created per period
    const newLeadsMap = new Map<string, number>();
    const convertedMap = new Map<string, number>();

    for (const lead of allLeads) {
      const period = formatPeriod(lead.createdAt, grouping);
      newLeadsMap.set(period, (newLeadsMap.get(period) ?? 0) + 1);
      if (lead.status === 'MARK_AS_CUSTOMER') {
        convertedMap.set(period, (convertedMap.get(period) ?? 0) + 1);
      }
    }

    const allPeriods = generatePeriods(from, to, grouping);
    const chart = allPeriods.map((period) => ({
      period,
      newLeads: newLeadsMap.get(period) ?? 0,
      converted: convertedMap.get(period) ?? 0,
    }));

    return {
      totalLeads: allLeads.length,
      byStatus,
      bySource,
      todayFollowups: todayFollowupsRaw.length,
      grouping: grouping === 'daily' ? 'day' : grouping === 'weekly' ? 'week' : 'month',
      chart,
    };
  }

  /**
   * GET /api/v1/admin/analytics/utm
   * UTM analytics with optional from/to and distributorUuid filters.
   * When no from/to provided, returns all-time (lifetime) data.
   */
  async getUtmAnalytics(dto: AnalyticsQueryDto & { distributorUuid?: string }) {
    const hasDateRange = !!(dto?.from && dto?.to);

    // Only parse dates (and validate) when both params are explicitly provided
    let from: Date | undefined;
    let to: Date | undefined;
    if (hasDateRange) {
      const range = this.parseDateRange(dto);
      from = range.from;
      to = range.to;
    }

    // Build where clause — no createdAt filter when no date params (lifetime mode)
    const leadWhere: Record<string, unknown> = {};
    if (from && to) {
      leadWhere['createdAt'] = { gte: from, lte: to };
    }
    if (dto.distributorUuid) {
      leadWhere['distributorUuid'] = dto.distributorUuid;
    }

    const leads = await this.prisma.lead.findMany({
      where: leadWhere,
      select: { userUuid: true },
    });

    const userUuids = leads.map((l) => l.userUuid);

    if (userUuids.length === 0) {
      return {
        bySource: [],
        byMedium: [],
        byCampaign: [],
        total: 0,
        from: from?.toISOString() ?? null,
        to: to?.toISOString() ?? null,
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

    const bySource = Array.from(sourceMap.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([source, leads]) => ({ source, leads }));
    const byMedium = Array.from(mediumMap.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([medium, leads]) => ({ medium, leads }));
    const byCampaign = Array.from(campaignMap.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([campaign, leads]) => ({ campaign, leads }));

    return {
      bySource,
      byMedium,
      byCampaign,
      total: userUuids.length,
      from: from?.toISOString() ?? null,
      to: to?.toISOString() ?? null,
    };
  }

  /**
   * GET /api/v1/admin/analytics/distributors
   */
  async getDistributorsAnalytics(dto: AnalyticsQueryDto) {
    const hasDateRange = !!(dto?.from && dto?.to);
    const { from, to } = this.parseDateRange(dto);

    const [totalDistributors, allDistributors] = await Promise.all([
      this.prisma.user.count({ where: { role: 'DISTRIBUTOR' } }),
      this.prisma.user.findMany({
        where: { role: 'DISTRIBUTOR' },
        select: {
          uuid: true,
          fullName: true,
          distributorCode: true,
          leadsDistributed: {
            select: { status: true, createdAt: true, updatedAt: true },
          },
        },
      }),
    ]);

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let activeThisMonth = 0;
    let totalLeadsAcross = 0;
    let totalConversions = 0;

    const topDistributorStats = allDistributors.map((d) => {
      const leads = d.leadsDistributed;
      const total = leads.length;
      const converted = leads.filter(
        (l) => l.status === 'MARK_AS_CUSTOMER',
      ).length;
      const isActive = leads.some((l) => l.updatedAt >= thisMonthStart);
      if (isActive) activeThisMonth++;
      totalLeadsAcross += total;
      totalConversions += converted;
      const rate =
        total > 0 ? parseFloat(((converted / total) * 100).toFixed(1)) : 0;
      return {
        uuid: d.uuid,
        fullName: d.fullName,
        distributorCode: d.distributorCode ?? null,
        totalLeads: total,
        convertedLeads: converted,
        conversionRate: rate,
      };
    });

    const avgLeadsPerDistributor =
      totalDistributors > 0
        ? Math.round(totalLeadsAcross / totalDistributors)
        : 0;
    const avgConversionRate =
      totalLeadsAcross > 0
        ? parseFloat(((totalConversions / totalLeadsAcross) * 100).toFixed(1))
        : 0;

    const topDistributors = [...topDistributorStats]
      .sort((a, b) => b.totalLeads - a.totalLeads)
      .slice(0, 10);

    // Funnel path: leads from distributors, count by status
    const distributorLeads = await this.prisma.lead.findMany({
      where: {
        distributorUuid: { not: null },
        createdAt: { gte: from, lte: to },
      },
      select: { status: true },
    });

    const statusMap = new Map<string, number>();
    for (const l of distributorLeads) {
      statusMap.set(l.status, (statusMap.get(l.status) ?? 0) + 1);
    }
    const funnelPath = Array.from(statusMap.entries()).map(
      ([stage, count]) => ({
        stage,
        count,
      }),
    );

    return {
      lifetime: {
        totalDistributors,
        avgLeadsPerDistributor,
        avgConversionRate,
        topDistributors,
      },
      thisMonth: {
        activeDistributors: activeThisMonth,
      },
      period: {
        from: hasDateRange ? from.toISOString() : null,
        to: hasDateRange ? to.toISOString() : null,
        funnelPath,
      },
    };
  }
}
