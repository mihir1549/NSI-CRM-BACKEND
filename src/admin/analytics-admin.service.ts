import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AnalyticsQueryDto } from './dto/analytics-query.dto.js';

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

    const days = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
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
  private getGrouping(from: Date, to: Date): 'day' | 'week' | 'month' {
    const days = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 30) return 'day';
    if (days <= 180) return 'week';
    return 'month';
  }

  /**
   * Format a date into the right period string based on grouping.
   */
  private formatPeriod(date: Date, grouping: 'day' | 'week' | 'month'): string {
    if (grouping === 'day') {
      return date.toISOString().slice(0, 10);
    }
    if (grouping === 'week') {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(d.setDate(diff));
      return monday.toISOString().slice(0, 10);
    }
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Calculate growth percentage compared to previous period.
   */
  private calculateGrowth(current: number, previous: number): number {
    if (previous === 0) return 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  /**
   * GET /api/v1/admin/analytics/dashboard
   */
  async getDashboard(dto: AnalyticsQueryDto) {
    const { from, to, previousFrom, previousTo } = this.parseDateRange(dto);

    const [
      totalUsers,
      prevTotalUsers,
      hotLeads,
      prevHotLeads,
      customers,
      prevCustomers,
      distributors,
      prevDistributors,
      machinesSold,
      phoneVerifiedCount,
      paymentsCompletedCount,
      decisionYesCount,
      decisionNoCount,
      funnelRegistered,
      funnelEmailVerified,
      funnelPhoneVerified,
      funnelPaymentDone,
      funnelDecisionYes,
    ] = await Promise.all([
      // Users created in range
      this.prisma.user.count({ where: { createdAt: { gte: from, lte: to } } }),
      this.prisma.user.count({ where: { createdAt: { gte: previousFrom, lte: previousTo } } }),

      // Hot leads updated in range
      this.prisma.lead.count({ where: { status: 'HOT', updatedAt: { gte: from, lte: to } } }),
      this.prisma.lead.count({ where: { status: 'HOT', updatedAt: { gte: previousFrom, lte: previousTo } } }),

      // Users with role CUSTOMER created in range
      this.prisma.user.count({ where: { role: 'CUSTOMER', createdAt: { gte: from, lte: to } } }),
      this.prisma.user.count({ where: { role: 'CUSTOMER', createdAt: { gte: previousFrom, lte: previousTo } } }),

      // Distributors created in range
      this.prisma.user.count({ where: { role: 'DISTRIBUTOR', createdAt: { gte: from, lte: to } } }),
      this.prisma.user.count({ where: { role: 'DISTRIBUTOR', createdAt: { gte: previousFrom, lte: previousTo } } }),

      // Commitment fee payments (machines sold) in range
      this.prisma.payment.count({
        where: { status: 'SUCCESS', paymentType: 'COMMITMENT_FEE', createdAt: { gte: from, lte: to } },
      }),

      // Phone verified users in range
      this.prisma.userProfile.count({ where: { phoneVerifiedAt: { not: null, gte: from, lte: to } } }),

      // Payment completed funnel progress in range
      this.prisma.funnelProgress.count({ where: { paymentCompleted: true, updatedAt: { gte: from, lte: to } } }),

      // Decision YES in range
      this.prisma.funnelProgress.count({
        where: { decisionAnswer: 'yes', decisionAnsweredAt: { gte: from, lte: to } },
      }),

      // Decision NO in range
      this.prisma.funnelProgress.count({
        where: { decisionAnswer: 'no', decisionAnsweredAt: { gte: from, lte: to } },
      }),

      // Funnel stages (users created in range)
      this.prisma.user.count({ where: { createdAt: { gte: from, lte: to } } }),
      this.prisma.user.count({ where: { emailVerified: true, createdAt: { gte: from, lte: to } } }),
      this.prisma.userProfile.count({
        where: { phoneVerifiedAt: { not: null }, user: { createdAt: { gte: from, lte: to } } },
      }),
      this.prisma.funnelProgress.count({
        where: { paymentCompleted: true, user: { createdAt: { gte: from, lte: to } } },
      }),
      this.prisma.funnelProgress.count({
        where: { decisionAnswer: 'yes', user: { createdAt: { gte: from, lte: to } } },
      }),
    ]);

    const totalDecisions = decisionYesCount + decisionNoCount;
    const yesPercent =
      totalDecisions > 0 ? `${((decisionYesCount / totalDecisions) * 100).toFixed(1)}%` : '0.0%';

    return {
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
        distributorsGrowth: this.calculateGrowth(distributors, prevDistributors),
        machinesSold,
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
    };
  }

  /**
   * GET /api/v1/admin/analytics/funnel
   */
  async getFunnelAnalytics(dto: AnalyticsQueryDto) {
    const { from, to } = this.parseDateRange(dto);
    const grouping = this.getGrouping(from, to);

    const [
      registered,
      emailVerified,
      phoneVerified,
      paymentDone,
      decisionYes,
    ] = await Promise.all([
      this.prisma.user.count({ where: { createdAt: { gte: from, lte: to } } }),
      this.prisma.user.count({ where: { emailVerified: true, createdAt: { gte: from, lte: to } } }),
      this.prisma.userProfile.count({
        where: {
          phoneVerifiedAt: { not: null },
          user: { createdAt: { gte: from, lte: to } },
        },
      }),
      this.prisma.funnelProgress.count({
        where: { paymentCompleted: true, user: { createdAt: { gte: from, lte: to } } },
      }),
      this.prisma.funnelProgress.count({
        where: { decisionAnswer: 'yes', user: { createdAt: { gte: from, lte: to } } },
      }),
    ]);

    const stageCounts = [registered, emailVerified, phoneVerified, paymentDone, decisionYes];
    const stageNames = ['Registered', 'Email Verified', 'Phone Verified', 'Payment Done', 'Decision YES'];

    const stages = stageNames.map((stage, i) => {
      const count = stageCounts[i];
      const prevCount = i === 0 ? 0 : stageCounts[i - 1];
      const dropoffFromPrevious = i === 0 ? 0 : prevCount - count;
      const dropoffPercent =
        i === 0 || prevCount === 0
          ? '0.0%'
          : `${(((prevCount - count) / prevCount) * 100).toFixed(1)}%`;
      const conversionFromStart =
        registered === 0 ? '0.0%' : `${((count / registered) * 100).toFixed(1)}%`;

      return { stage, count, dropoffFromPrevious, dropoffPercent, conversionFromStart };
    });

    return { grouping, stages };
  }

  /**
   * GET /api/v1/admin/analytics/revenue
   */
  async getRevenueAnalytics(dto: AnalyticsQueryDto) {
    const { from, to, previousFrom, previousTo } = this.parseDateRange(dto);
    const grouping = this.getGrouping(from, to);

    const [currentPayments, previousPayments] = await Promise.all([
      this.prisma.payment.findMany({
        where: { status: 'SUCCESS', createdAt: { gte: from, lte: to } },
        select: { finalAmount: true, paymentType: true, createdAt: true, user: { select: { country: true } } },
      }),
      this.prisma.payment.findMany({
        where: { status: 'SUCCESS', createdAt: { gte: previousFrom, lte: previousTo } },
        select: { finalAmount: true },
      }),
    ]);

    const totalRevenue = currentPayments.reduce((sum, p) => sum + p.finalAmount, 0);
    const prevRevenue = previousPayments.reduce((sum, p) => sum + p.finalAmount, 0);
    const totalRevenueGrowth = this.calculateGrowth(totalRevenue, prevRevenue);

    // By type
    const byType = { commitmentFee: 0, lmsCourse: 0, distributorSubscription: 0 };
    for (const p of currentPayments) {
      if (p.paymentType === 'COMMITMENT_FEE') byType.commitmentFee += p.finalAmount;
      else if (p.paymentType === 'LMS_COURSE') byType.lmsCourse += p.finalAmount;
      else if (p.paymentType === 'DISTRIBUTOR_SUB') byType.distributorSubscription += p.finalAmount;
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
      const period = this.formatPeriod(p.createdAt, grouping);
      chartMap.set(period, (chartMap.get(period) ?? 0) + p.finalAmount);
    }
    const chart = Array.from(chartMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, revenue]) => ({ period, revenue }));

    return {
      totalRevenue,
      totalRevenueGrowth,
      byType,
      byCountry,
      grouping,
      chart,
    };
  }

  /**
   * GET /api/v1/admin/analytics/leads
   */
  async getLeadsAnalytics(dto: AnalyticsQueryDto) {
    const { from, to } = this.parseDateRange(dto);
    const grouping = this.getGrouping(from, to);

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
      new: 0, warm: 0, hot: 0, contacted: 0,
      followup: 0, nurture: 0, lost: 0, converted: 0,
    };
    const bySource = { direct: 0, viaDistributor: 0 };

    for (const lead of allLeads) {
      switch (lead.status) {
        case 'NEW': byStatus.new++; break;
        case 'WARM': byStatus.warm++; break;
        case 'HOT': byStatus.hot++; break;
        case 'CONTACTED': byStatus.contacted++; break;
        case 'FOLLOWUP': byStatus.followup++; break;
        case 'NURTURE': byStatus.nurture++; break;
        case 'LOST': byStatus.lost++; break;
        case 'MARK_AS_CUSTOMER': byStatus.converted++; break;
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
      const period = this.formatPeriod(lead.createdAt, grouping);
      newLeadsMap.set(period, (newLeadsMap.get(period) ?? 0) + 1);
      if (lead.status === 'MARK_AS_CUSTOMER') {
        convertedMap.set(period, (convertedMap.get(period) ?? 0) + 1);
      }
    }

    const allPeriods = new Set([...newLeadsMap.keys(), ...convertedMap.keys()]);
    const chart = Array.from(allPeriods)
      .sort()
      .map((period) => ({
        period,
        newLeads: newLeadsMap.get(period) ?? 0,
        converted: convertedMap.get(period) ?? 0,
      }));

    return {
      totalLeads: allLeads.length,
      byStatus,
      bySource,
      todayFollowups: todayFollowupsRaw.length,
      grouping,
      chart,
    };
  }

  /**
   * GET /api/v1/admin/analytics/utm
   * UTM analytics with optional distributorUuid filter.
   */
  async getUtmAnalytics(dto: AnalyticsQueryDto & { distributorUuid?: string }) {
    const { from, to } = this.parseDateRange(dto);

    // Build where clause for leads
    const leadWhere: Record<string, unknown> = {
      createdAt: { gte: from, lte: to },
    };
    if (dto.distributorUuid) {
      leadWhere['distributorUuid'] = dto.distributorUuid;
    }

    // Find all leads in range (with optional distributor filter)
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
        from: from.toISOString(),
        to: to.toISOString(),
      };
    }

    // Fetch acquisition data for these users
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
      from: from.toISOString(),
      to: to.toISOString(),
    };
  }

  /**
   * GET /api/v1/admin/analytics/distributors
   */
  async getDistributorsAnalytics(dto: AnalyticsQueryDto) {
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
      const converted = leads.filter((l) => l.status === 'MARK_AS_CUSTOMER').length;
      const isActive = leads.some((l) => l.updatedAt >= thisMonthStart);
      if (isActive) activeThisMonth++;
      totalLeadsAcross += total;
      totalConversions += converted;
      const rate = total > 0 ? `${((converted / total) * 100).toFixed(1)}%` : '0.0%';
      return { uuid: d.uuid, fullName: d.fullName, distributorCode: d.distributorCode ?? null, totalLeads: total, convertedLeads: converted, conversionRate: rate };
    });

    const avgLeadsPerDistributor =
      totalDistributors > 0 ? Math.round(totalLeadsAcross / totalDistributors) : 0;
    const avgConversionRate =
      totalLeadsAcross > 0
        ? `${((totalConversions / totalLeadsAcross) * 100).toFixed(1)}%`
        : '0.0%';

    const topDistributors = [...topDistributorStats]
      .sort((a, b) => b.totalLeads - a.totalLeads)
      .slice(0, 10);

    // Funnel path: leads from distributors, count by status
    const distributorLeads = await this.prisma.lead.findMany({
      where: { distributorUuid: { not: null }, createdAt: { gte: from, lte: to } },
      select: { status: true },
    });

    const statusMap = new Map<string, number>();
    for (const l of distributorLeads) {
      statusMap.set(l.status, (statusMap.get(l.status) ?? 0) + 1);
    }
    const funnelPath = Array.from(statusMap.entries()).map(([stage, count]) => ({
      stage,
      count,
    }));

    return {
      totalDistributors,
      activeThisMonth,
      avgLeadsPerDistributor,
      avgConversionRate,
      topDistributors,
      funnelPath,
    };
  }
}
