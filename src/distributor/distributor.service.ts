import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { LeadStatus } from '@prisma/client';
import QRCode from 'qrcode';
import type { UtmQueryDto } from './dto/utm-query.dto.js';

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

    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'https://growithnsi.com');
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

  async getDashboard(userUuid: string) {
    const user = await this.prisma.user.findUnique({
      where: { uuid: userUuid },
      select: { distributorCode: true, joinLinkActive: true },
    });

    const [totalLeads, hotLeads, contactedLeads, customers, subscription] = await Promise.all([
      this.prisma.lead.count({ where: { distributorUuid: userUuid } }),
      this.prisma.lead.count({ where: { distributorUuid: userUuid, status: LeadStatus.HOT } }),
      this.prisma.lead.count({ where: { distributorUuid: userUuid, status: LeadStatus.CONTACTED } }),
      this.prisma.lead.count({ where: { distributorUuid: userUuid, status: LeadStatus.MARK_AS_CUSTOMER } }),
      this.prisma.distributorSubscription.findUnique({
        where: { userUuid },
        include: { plan: { select: { name: true, amount: true } } },
      }),
    ]);

    const conversionRate =
      totalLeads === 0
        ? '0.00%'
        : `${((customers / totalLeads) * 100).toFixed(2)}%`;

    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'https://growithnsi.com');
    const joinLink = user?.distributorCode
      ? { url: `${frontendUrl}/join/${user.distributorCode}`, isActive: user.joinLinkActive }
      : null;

    const subscriptionData = subscription
      ? {
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
          graceDeadline: subscription.graceDeadline,
          plan: subscription.plan,
        }
      : null;

    return {
      totalLeads,
      hotLeads,
      contactedLeads,
      customers,
      conversionRate,
      subscription: subscriptionData,
      joinLink,
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

  // ─── Public: resolve join code ─────────────────────────────────────────────

  async resolveJoinCode(code: string) {
    const user = await this.prisma.user.findFirst({
      where: { distributorCode: { equals: code, mode: 'insensitive' } },
      select: { uuid: true, fullName: true, distributorCode: true, joinLinkActive: true },
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
