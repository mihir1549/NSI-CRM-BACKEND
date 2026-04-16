import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateCampaignDto } from './dto/create-campaign.dto.js';
import type { UpdateCampaignDto } from './dto/update-campaign.dto.js';

type OwnerType = 'DISTRIBUTOR' | 'ADMIN';

const ownerSelect = { uuid: true, fullName: true, distributorCode: true };

@Injectable()
export class CampaignService {
  private readonly logger = new Logger(CampaignService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── URL Generator ─────────────────────────────────────────────────────────

  private generateUrl(
    campaign: {
      utmSource: string;
      utmMedium: string;
      utmCampaign: string;
      utmContent: string | null;
    },
    distributorCode?: string | null,
  ): string {
    const base = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const params = new URLSearchParams();
    params.set('utm_source', campaign.utmSource);
    params.set('utm_medium', campaign.utmMedium);
    params.set('utm_campaign', campaign.utmCampaign);
    if (campaign.utmContent) params.set('utm_content', campaign.utmContent);
    if (distributorCode) params.set('ref', distributorCode);
    return `${base}?${params.toString()}`;
  }

  // ─── Analytics ─────────────────────────────────────────────────────────────

  private async getCampaignAnalytics(utmCampaign: string) {
    const acquisitions = await this.prisma.userAcquisition.findMany({
      where: { utmCampaign },
      select: { userUuid: true },
    });

    const clicks = acquisitions.length;
    const userUuids = acquisitions.map((a) => a.userUuid);

    if (userUuids.length === 0) {
      return { clicks: 0, signups: 0, funnelCompletions: 0, conversions: 0 };
    }

    const [signups, funnelCompletions, conversions] = await Promise.all([
      this.prisma.user.count({
        where: { uuid: { in: userUuids }, emailVerified: true },
      }),
      this.prisma.funnelProgress.count({
        where: { userUuid: { in: userUuids }, paymentCompleted: true },
      }),
      this.prisma.funnelProgress.count({
        where: { userUuid: { in: userUuids }, decisionAnswer: 'yes' },
      }),
    ]);

    return { clicks, signups, funnelCompletions, conversions };
  }

  // ─── Ownership check helper ─────────────────────────────────────────────────

  private async findOwnedCampaign(
    uuid: string,
    ownerUuid: string,
    ownerType: OwnerType,
  ) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { uuid },
      include: { owner: { select: ownerSelect } },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (ownerType === 'DISTRIBUTOR' && campaign.ownerUuid !== ownerUuid) {
      throw new NotFoundException('Campaign not found');
    }
    return campaign;
  }

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  async createCampaign(
    ownerUuid: string,
    ownerType: OwnerType,
    dto: CreateCampaignDto,
  ) {
    // Check for duplicate slug by this owner
    const existing = await this.prisma.campaign.findFirst({
      where: { ownerUuid, utmCampaign: dto.utmCampaign },
    });
    if (existing) {
      throw new ConflictException('Campaign with this UTM slug already exists');
    }

    const campaign = await this.prisma.campaign.create({
      data: {
        ownerUuid,
        ownerType,
        name: dto.name,
        utmSource: dto.utmSource,
        utmMedium: dto.utmMedium,
        utmCampaign: dto.utmCampaign,
        utmContent: dto.utmContent ?? null,
      },
      include: { owner: { select: ownerSelect } },
    });

    const generatedUrl = this.generateUrl(
      campaign,
      campaign.owner.distributorCode,
    );
    return { ...campaign, generatedUrl };
  }

  async listCampaigns(
    ownerUuid: string,
    ownerType: OwnerType,
    page = 1,
    limit = 20,
  ) {
    const where = ownerType === 'DISTRIBUTOR' ? { ownerUuid } : {};
    const skip = (page - 1) * limit;

    const [campaigns, total] = await this.prisma.$transaction([
      this.prisma.campaign.findMany({
        where,
        include: { owner: { select: ownerSelect } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.campaign.count({ where }),
    ]);

    return {
      data: campaigns.map((c) => ({
        ...c,
        generatedUrl: this.generateUrl(c, c.owner.distributorCode),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getCampaign(uuid: string, ownerUuid: string, ownerType: OwnerType) {
    const campaign = await this.findOwnedCampaign(uuid, ownerUuid, ownerType);
    const generatedUrl = this.generateUrl(
      campaign,
      campaign.owner.distributorCode,
    );
    const analytics = await this.getCampaignAnalytics(campaign.utmCampaign);
    return { ...campaign, generatedUrl, analytics };
  }

  async getCampaignForUpdate(
    uuid: string,
    ownerUuid: string,
    ownerType: OwnerType,
  ) {
    const campaign = await this.findOwnedCampaign(uuid, ownerUuid, ownerType);
    return {
      name: campaign.name,
      utmSource: campaign.utmSource,
      utmMedium: campaign.utmMedium,
      utmCampaign: campaign.utmCampaign,
      utmContent: campaign.utmContent,
      isActive: campaign.isActive,
    };
  }

  async updateCampaign(
    uuid: string,
    ownerUuid: string,
    ownerType: OwnerType,
    dto: UpdateCampaignDto,
  ) {
    const campaign = await this.findOwnedCampaign(uuid, ownerUuid, ownerType);

    // If slug is changing, check for conflict (exclude self)
    if (dto.utmCampaign && dto.utmCampaign !== campaign.utmCampaign) {
      const conflict = await this.prisma.campaign.findFirst({
        where: {
          ownerUuid: campaign.ownerUuid,
          utmCampaign: dto.utmCampaign,
          uuid: { not: uuid },
        },
      });
      if (conflict) {
        throw new ConflictException(
          'Campaign with this UTM slug already exists',
        );
      }
    }

    const updated = await this.prisma.campaign.update({
      where: { uuid },
      data: dto,
      include: { owner: { select: ownerSelect } },
    });

    const generatedUrl = this.generateUrl(
      updated,
      updated.owner.distributorCode,
    );
    return { ...updated, generatedUrl };
  }

  async deleteCampaign(uuid: string, ownerUuid: string, ownerType: OwnerType) {
    await this.findOwnedCampaign(uuid, ownerUuid, ownerType);
    await this.prisma.campaign.delete({ where: { uuid } });
    return { message: 'Campaign deleted' };
  }
}
