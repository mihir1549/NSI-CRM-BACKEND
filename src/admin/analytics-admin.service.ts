import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AnalyticsQueryDto } from './dto/analytics-query.dto.js';
import { autoGranularity, generatePeriods } from '../common/utils/generate-periods.util.js';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class AnalyticsAdminService {
  private readonly MAX_RANGE_DAYS = 1825; // 5 years

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

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
    const cacheKey = `analytics:dashboard:${dto.from ?? 'all'}:${dto.to ?? 'all'}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

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
      // Batch 1 already computed period-filtered user/distributor counts with
      // the exact same where clauses — reuse them instead of re-querying.
      const pUsers = totalUsers;
      const prevPUsers = prevTotalUsers;
      const pDistributors = distributors;
      const prevPDistributors = prevDistributors;

      const [
        pLeads,
        prevPLeads,
        pCustomers,
        prevPCustomers,
        pRevenueAgg,
        prevPRevenueAgg,
      ] = await Promise.all([
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
      const count = g._count.deviceType;
      if (type === 'mobile') deviceCounts.mobile += count;
      else if (type === 'desktop') deviceCounts.desktop += count;
      else if (type === 'tablet') deviceCounts.tablet += count;
    }
    const devices = deviceCounts;

    // ─── Browser breakdown (top 3 + Other) ───────────────────────────────────
    const browserMap = new Map<string, number>();
    let totalBrowserCount = 0;
    for (const g of browserGroups) {
      const name = g.browser ?? 'Unknown';
      const key = name.toLowerCase();
      const count = g._count.browser;
      browserMap.set(key, (browserMap.get(key) ?? 0) + count);
      totalBrowserCount += count;
    }

    let topBrowsers: Array<{ browser: string; percentage: number }> = [];
    if (totalBrowserCount > 0) {
      // Sort normalized browsers by count
      const sorted = Array.from(browserMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([key, count]) => ({
          // Re-capitalize first letter for better UI
          browser: key.charAt(0).toUpperCase() + key.slice(1),
          percentage: Math.round((count / totalBrowserCount) * 1000) / 10,
        }));

      const top3 = sorted.slice(0, 3);
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

    const result = {
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
    await this.cache.set(cacheKey, result, 60_000);
    return result;
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
    const cacheKey = `analytics:revenue:${dto.from ?? 'all'}:${dto.to ?? 'all'}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const { from, to, previousFrom, previousTo } = this.parseDateRange(dto);
    const grouping = autoGranularity(from, to);

    // Map grouping → Postgres date_trunc unit + to_char format.
    // Both are strictly typed literals — safe to interpolate as SQL parameters.
    const truncUnit: 'day' | 'week' | 'month' =
      grouping === 'daily' ? 'day' : grouping === 'weekly' ? 'week' : 'month';
    const periodFormat = grouping === 'monthly' ? 'YYYY-MM' : 'YYYY-MM-DD';

    const [byTypeGroups, prevAgg, byCountryRows, chartRows] = await Promise.all([
      this.prisma.payment.groupBy({
        by: ['paymentType'],
        where: { status: 'SUCCESS', createdAt: { gte: from, lte: to } },
        _sum: { finalAmount: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          status: 'SUCCESS',
          createdAt: { gte: previousFrom, lte: previousTo },
        },
        _sum: { finalAmount: true },
      }),
      this.prisma.$queryRaw<
        Array<{ country: string; revenue: bigint | number | null }>
      >(Prisma.sql`
        SELECT COALESCE(u.country, 'Unknown') AS country,
               COALESCE(SUM(p."finalAmount"), 0)::bigint AS revenue
        FROM payments p
        JOIN users u ON u.uuid = p."userUuid"
        WHERE p.status = 'SUCCESS'
          AND p."createdAt" >= ${from}
          AND p."createdAt" <= ${to}
        GROUP BY COALESCE(u.country, 'Unknown')
        ORDER BY revenue DESC
      `),
      this.prisma.$queryRaw<
        Array<{ period: string; revenue: bigint | number | null }>
      >(Prisma.sql`
        SELECT to_char(date_trunc(${truncUnit}::text, "createdAt"), ${periodFormat}::text) AS period,
               COALESCE(SUM("finalAmount"), 0)::bigint AS revenue
        FROM payments
        WHERE status = 'SUCCESS'
          AND "createdAt" >= ${from}
          AND "createdAt" <= ${to}
        GROUP BY period
      `),
    ]);

    const byType = {
      commitmentFee: 0,
      lmsCourse: 0,
      distributorSubscription: 0,
    };
    let totalRevenue = 0;
    for (const g of byTypeGroups) {
      const sum = g._sum.finalAmount ?? 0;
      totalRevenue += sum;
      if (g.paymentType === 'COMMITMENT_FEE') byType.commitmentFee = sum;
      else if (g.paymentType === 'LMS_COURSE') byType.lmsCourse = sum;
      else if (g.paymentType === 'DISTRIBUTOR_SUB')
        byType.distributorSubscription = sum;
    }

    const prevRevenue = prevAgg._sum.finalAmount ?? 0;
    const totalRevenueGrowth = this.calculateGrowth(totalRevenue, prevRevenue);

    const byCountry = byCountryRows.map((r) => ({
      country: r.country,
      revenue: Number(r.revenue ?? 0),
    }));

    const chartMap = new Map<string, number>();
    for (const r of chartRows) {
      chartMap.set(r.period, Number(r.revenue ?? 0));
    }

    const allPeriods = generatePeriods(from, to, grouping);
    const chart = allPeriods.map((period) => ({
      period,
      revenue: chartMap.get(period) ?? 0,
    }));

    const result = {
      totalRevenue,
      totalRevenueGrowth,
      byType,
      byCountry,
      grouping: grouping === 'daily' ? 'day' : grouping === 'weekly' ? 'week' : 'month',
      chart,
    };
    await this.cache.set(cacheKey, result, 60_000);
    return result;
  }

  /**
   * GET /api/v1/admin/analytics/leads
   */
  async getLeadsAnalytics(dto: AnalyticsQueryDto) {
    const cacheKey = `analytics:leads:${dto.from ?? 'all'}:${dto.to ?? 'all'}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const { from, to } = this.parseDateRange(dto);
    const grouping = autoGranularity(from, to);
    const truncUnit: 'day' | 'week' | 'month' =
      grouping === 'daily' ? 'day' : grouping === 'weekly' ? 'week' : 'month';
    const periodFormat = grouping === 'monthly' ? 'YYYY-MM' : 'YYYY-MM-DD';

    const [statusGroups, sourceRows, chartRows, todayFollowupsGroups] =
      await Promise.all([
        this.prisma.lead.groupBy({
          by: ['status'],
          where: { createdAt: { gte: from, lte: to } },
          _count: { uuid: true },
        }),
        // bySource can't use Prisma groupBy (needs a CASE on distributorUuid
        // IS NULL) — express with $queryRaw.
        this.prisma.$queryRaw<Array<{ source: string; count: bigint }>>(
          Prisma.sql`
            SELECT CASE
                     WHEN "distributorUuid" IS NULL THEN 'direct'
                     ELSE 'viaDistributor'
                   END AS source,
                   COUNT(*)::bigint AS count
            FROM leads
            WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
            GROUP BY source
          `,
        ),
        // Chart: new leads + converted per period bucket, all counted in SQL.
        this.prisma.$queryRaw<
          Array<{ period: string; newLeads: bigint; converted: bigint }>
        >(Prisma.sql`
          SELECT to_char(date_trunc(${truncUnit}::text, "createdAt"), ${periodFormat}::text) AS period,
                 COUNT(*)::bigint AS "newLeads",
                 COUNT(*) FILTER (WHERE status = 'MARK_AS_CUSTOMER')::bigint AS converted
          FROM leads
          WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
          GROUP BY period
        `),
        // todayFollowups — count of distinct leads with a followup scheduled
        // today. groupBy(leadUuid).length == distinct count.
        this.prisma.leadActivity.groupBy({
          by: ['leadUuid'],
          where: {
            action: 'FOLLOWUP_SCHEDULED',
            followupAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
              lte: new Date(new Date().setHours(23, 59, 59, 999)),
            },
          },
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
    let totalLeads = 0;
    for (const g of statusGroups) {
      const count = g._count.uuid;
      totalLeads += count;
      switch (g.status) {
        case 'NEW':
          byStatus.new = count;
          break;
        case 'WARM':
          byStatus.warm = count;
          break;
        case 'HOT':
          byStatus.hot = count;
          break;
        case 'CONTACTED':
          byStatus.contacted = count;
          break;
        case 'FOLLOWUP':
          byStatus.followup = count;
          break;
        case 'NURTURE':
          byStatus.nurture = count;
          break;
        case 'LOST':
          byStatus.lost = count;
          break;
        case 'MARK_AS_CUSTOMER':
          byStatus.converted = count;
          break;
      }
    }

    const bySource = { direct: 0, viaDistributor: 0 };
    for (const r of sourceRows) {
      if (r.source === 'direct') bySource.direct = Number(r.count);
      else if (r.source === 'viaDistributor')
        bySource.viaDistributor = Number(r.count);
    }

    const newLeadsMap = new Map<string, number>();
    const convertedMap = new Map<string, number>();
    for (const r of chartRows) {
      newLeadsMap.set(r.period, Number(r.newLeads));
      convertedMap.set(r.period, Number(r.converted));
    }

    const allPeriods = generatePeriods(from, to, grouping);
    const chart = allPeriods.map((period) => ({
      period,
      newLeads: newLeadsMap.get(period) ?? 0,
      converted: convertedMap.get(period) ?? 0,
    }));

    const result = {
      totalLeads,
      byStatus,
      bySource,
      todayFollowups: todayFollowupsGroups.length,
      grouping: grouping === 'daily' ? 'day' : grouping === 'weekly' ? 'week' : 'month',
      chart,
    };
    await this.cache.set(cacheKey, result, 60_000);
    return result;
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
    const leadWhere: Prisma.LeadWhereInput = {};
    if (from && to) {
      leadWhere.createdAt = { gte: from, lte: to };
    }
    if (dto.distributorUuid) {
      leadWhere.distributorUuid = dto.distributorUuid;
    }

    // Total = count of leads matching filter (equals the old userUuids.length
    // since Lead.userUuid is @unique).
    const total = await this.prisma.lead.count({ where: leadWhere });

    if (total === 0) {
      return {
        bySource: [],
        byMedium: [],
        byCampaign: [],
        total: 0,
        from: from?.toISOString() ?? null,
        to: to?.toISOString() ?? null,
      };
    }

    // DB-level relation join: acquisitions whose user's lead matches the
    // filter. Lead.userUuid is @unique → one lead per user → `leadAsUser`
    // is a nullable 1:1 relation on User, filtered with `is`.
    const acquisitionWhere: Prisma.UserAcquisitionWhereInput = {
      user: { leadAsUser: { is: leadWhere } },
    };

    const [sourceGroups, mediumGroups, campaignGroups] = await Promise.all([
      this.prisma.userAcquisition.groupBy({
        by: ['utmSource'],
        where: acquisitionWhere,
        _count: { uuid: true },
      }),
      this.prisma.userAcquisition.groupBy({
        by: ['utmMedium'],
        where: acquisitionWhere,
        _count: { uuid: true },
      }),
      this.prisma.userAcquisition.groupBy({
        by: ['utmCampaign'],
        where: acquisitionWhere,
        _count: { uuid: true },
      }),
    ]);

    // Collapse null UTM values into 'direct' (matches old `|| 'direct'`)
    // and merge any pre-existing 'direct' group into the same bucket.
    const sourceMap = new Map<string, number>();
    for (const g of sourceGroups) {
      const key = g.utmSource ?? 'direct';
      sourceMap.set(key, (sourceMap.get(key) ?? 0) + g._count.uuid);
    }
    const bySource: Array<{ source: string; leads: number }> = Array.from(
      sourceMap.entries(),
    )
      .sort(([, a], [, b]) => b - a)
      .map(([source, leads]) => ({ source, leads }));

    const mediumMap = new Map<string, number>();
    for (const g of mediumGroups) {
      const key = g.utmMedium ?? 'direct';
      mediumMap.set(key, (mediumMap.get(key) ?? 0) + g._count.uuid);
    }
    const byMedium: Array<{ medium: string; leads: number }> = Array.from(
      mediumMap.entries(),
    )
      .sort(([, a], [, b]) => b - a)
      .map(([medium, leads]) => ({ medium, leads }));

    const campaignMap = new Map<string, number>();
    for (const g of campaignGroups) {
      const key = g.utmCampaign ?? 'direct';
      campaignMap.set(key, (campaignMap.get(key) ?? 0) + g._count.uuid);
    }
    const byCampaign: Array<{ campaign: string; leads: number }> = Array.from(
      campaignMap.entries(),
    )
      .sort(([, a], [, b]) => b - a)
      .map(([campaign, leads]) => ({ campaign, leads }));

    return {
      bySource,
      byMedium,
      byCampaign,
      total,
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

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Fetch only small columns per distributor (no relation pull) + four
    // aggregate queries. Prior code loaded every Lead for every distributor.
    const [
      allDistributors,
      totalsByDist,
      convertedByDist,
      activeByDist,
      funnelGroups,
    ] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: 'DISTRIBUTOR' },
        select: { uuid: true, fullName: true, distributorCode: true },
      }),
      this.prisma.lead.groupBy({
        by: ['distributorUuid'],
        where: { distributorUuid: { not: null } },
        _count: { uuid: true },
      }),
      this.prisma.lead.groupBy({
        by: ['distributorUuid'],
        where: {
          distributorUuid: { not: null },
          status: 'MARK_AS_CUSTOMER',
        },
        _count: { uuid: true },
      }),
      this.prisma.lead.groupBy({
        by: ['distributorUuid'],
        where: {
          distributorUuid: { not: null },
          updatedAt: { gte: thisMonthStart },
        },
      }),
      this.prisma.lead.groupBy({
        by: ['status'],
        where: {
          distributorUuid: { not: null },
          createdAt: { gte: from, lte: to },
        },
        _count: { uuid: true },
      }),
    ]);

    const totalDistributors = allDistributors.length;

    const totalsMap = new Map<string, number>();
    for (const r of totalsByDist) {
      if (r.distributorUuid) totalsMap.set(r.distributorUuid, r._count.uuid);
    }

    const convertedMap = new Map<string, number>();
    for (const r of convertedByDist) {
      if (r.distributorUuid)
        convertedMap.set(r.distributorUuid, r._count.uuid);
    }

    let totalLeadsAcross = 0;
    let totalConversions = 0;

    const topDistributorStats = allDistributors.map((d) => {
      const total = totalsMap.get(d.uuid) ?? 0;
      const converted = convertedMap.get(d.uuid) ?? 0;
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

    const activeThisMonth = activeByDist.length;

    const funnelPath = funnelGroups.map((g) => ({
      stage: g.status,
      count: g._count.uuid,
    }));

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
