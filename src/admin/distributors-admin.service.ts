import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DistributorsAdminService {
  private readonly frontendUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3001');
  }

  /**
   * List all distributors with stats, sorted by totalLeads DESC.
   */
  async listDistributors(query: {
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { role: 'DISTRIBUTOR' };

    if (query.search) {
      where['OR'] = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.status === 'deactivated') {
      where['joinLinkActive'] = false;
    } else if (query.status === 'active') {
      where['joinLinkActive'] = true;
    }

    const [distributors, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          uuid: true,
          fullName: true,
          email: true,
          country: true,
          distributorCode: true,
          joinLinkActive: true,
          createdAt: true,
          leadsDistributed: {
            select: {
              uuid: true,
              status: true,
              updatedAt: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const items = distributors
      .map((d) => {
        const leads = d.leadsDistributed;
        const totalLeads = leads.length;
        const hotLeads = leads.filter((l) => l.status === 'HOT').length;
        const convertedLeads = leads.filter((l) => l.status === 'MARK_AS_CUSTOMER').length;
        const conversionRate =
          totalLeads > 0
            ? `${((convertedLeads / totalLeads) * 100).toFixed(1)}%`
            : '0.0%';
        const activeThisMonth = leads.some((l) => l.updatedAt >= thisMonthStart);

        return {
          uuid: d.uuid,
          fullName: d.fullName,
          email: d.email,
          country: d.country ?? null,
          distributorCode: d.distributorCode ?? null,
          joinLink: d.distributorCode
            ? `${this.frontendUrl}/join/${d.distributorCode}`
            : null,
          joinLinkActive: d.joinLinkActive,
          createdAt: d.createdAt,
          totalLeads,
          hotLeads,
          convertedLeads,
          conversionRate,
          activeThisMonth,
        };
      })
      .sort((a, b) => b.totalLeads - a.totalLeads);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Get full distributor detail with recent leads and performance analytics.
   */
  async getDistributorDetail(uuid: string) {
    const distributor = await this.prisma.user.findUnique({
      where: { uuid },
      select: {
        uuid: true,
        fullName: true,
        email: true,
        country: true,
        distributorCode: true,
        joinLinkActive: true,
        createdAt: true,
        role: true,
        leadsDistributed: {
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                fullName: true,
                email: true,
                country: true,
                profile: { select: { phone: true } },
              },
            },
            activities: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!distributor || distributor.role !== 'DISTRIBUTOR') {
      throw new NotFoundException('Distributor not found');
    }

    const leads = distributor.leadsDistributed;
    const totalLeads = leads.length;
    const convertedLeads = leads.filter((l) => l.status === 'MARK_AS_CUSTOMER').length;
    const hotLeads = leads.filter((l) => l.status === 'HOT').length;
    const conversionRate =
      totalLeads > 0 ? `${((convertedLeads / totalLeads) * 100).toFixed(1)}%` : '0.0%';
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const activeThisMonth = leads.some((l) => l.updatedAt >= thisMonthStart);

    // Recent leads (up to 20)
    const recentLeads = leads.slice(0, 20).map((l) => ({
      uuid: l.uuid,
      userFullName: l.user.fullName,
      userEmail: l.user.email,
      phone: l.phone ?? l.user.profile?.phone ?? null,
      status: l.status,
      country: l.user.country ?? null,
      createdAt: l.createdAt,
      followupAt: l.activities[0]?.followupAt ?? null,
    }));

    // Funnel stage counts
    const statusCounts: Record<string, number> = {};
    for (const l of leads) {
      statusCounts[l.status] = (statusCounts[l.status] ?? 0) + 1;
    }
    const funnelPath = Object.entries(statusCounts).map(([stage, count]) => ({
      stage,
      count,
    }));

    // Leads by country
    const countryMap = new Map<string, number>();
    for (const l of leads) {
      const country = l.user.country ?? 'Unknown';
      countryMap.set(country, (countryMap.get(country) ?? 0) + 1);
    }
    const leadsByCountry = Array.from(countryMap.entries()).map(([country, count]) => ({
      country,
      count,
    }));

    // Leads over time (last 12 months, grouped by month)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const recentLeadsForChart = leads.filter((l) => l.createdAt >= twelveMonthsAgo);
    const periodMap = new Map<string, number>();
    for (const l of recentLeadsForChart) {
      const period = `${l.createdAt.getFullYear()}-${String(l.createdAt.getMonth() + 1).padStart(2, '0')}`;
      periodMap.set(period, (periodMap.get(period) ?? 0) + 1);
    }
    const leadsOverTime = Array.from(periodMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, count]) => ({ period, count }));

    return {
      uuid: distributor.uuid,
      fullName: distributor.fullName,
      email: distributor.email,
      country: distributor.country ?? null,
      distributorCode: distributor.distributorCode ?? null,
      joinLink: distributor.distributorCode
        ? `${this.frontendUrl}/join/${distributor.distributorCode}`
        : null,
      joinLinkActive: distributor.joinLinkActive,
      createdAt: distributor.createdAt,
      totalLeads,
      hotLeads,
      convertedLeads,
      conversionRate,
      activeThisMonth,
      recentLeads,
      performanceAnalytics: {
        totalReferrals: totalLeads,
        successfulConversions: convertedLeads,
        conversionRate,
        funnelPath,
        leadsByCountry,
        leadsOverTime,
      },
    };
  }

  /**
   * Deactivate a distributor's join link.
   */
  async deactivateLink(uuid: string, actorUuid: string, ipAddress: string) {
    const user = await this.prisma.user.findUnique({ where: { uuid } });
    if (!user || user.role !== 'DISTRIBUTOR') {
      throw new NotFoundException('Distributor not found');
    }

    await this.prisma.user.update({
      where: { uuid },
      data: { joinLinkActive: false },
    });

    this.auditService.log({
      actorUuid,
      action: 'DISTRIBUTOR_LINK_DEACTIVATED',
      metadata: { distributorUuid: uuid },
      ipAddress,
    });

    return { message: 'Join link deactivated' };
  }

  /**
   * Activate a distributor's join link.
   */
  async activateLink(uuid: string, actorUuid: string, ipAddress: string) {
    const user = await this.prisma.user.findUnique({ where: { uuid } });
    if (!user || user.role !== 'DISTRIBUTOR') {
      throw new NotFoundException('Distributor not found');
    }

    await this.prisma.user.update({
      where: { uuid },
      data: { joinLinkActive: true },
    });

    this.auditService.log({
      actorUuid,
      action: 'DISTRIBUTOR_LINK_ACTIVATED',
      metadata: { distributorUuid: uuid },
      ipAddress,
    });

    return { message: 'Join link activated' };
  }
}
