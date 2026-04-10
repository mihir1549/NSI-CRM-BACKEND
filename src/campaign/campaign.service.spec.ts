import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { CampaignService } from './campaign.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const OWNER_UUID    = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const CAMPAIGN_UUID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const USER_UUID     = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

const mockOwner = {
  uuid: OWNER_UUID,
  fullName: 'Rahul Dist',
  distributorCode: 'NSI-RAH01',
};

const mockCampaign = {
  uuid: CAMPAIGN_UUID,
  ownerUuid: OWNER_UUID,
  ownerType: 'DISTRIBUTOR' as const,
  name: 'Summer Campaign',
  utmSource: 'facebook',
  utmMedium: 'social',
  utmCampaign: 'summer-2026',
  utmContent: null,
  createdAt: new Date('2026-01-01'),
  owner: mockOwner,
};

// ─── Prisma mock ──────────────────────────────────────────────────────────────
const mockPrisma = {
  campaign: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  userAcquisition: {
    findMany: jest.fn(),
  },
  user: {
    count: jest.fn(),
  },
  funnelProgress: {
    count: jest.fn(),
  },
};

describe('CampaignService', () => {
  let service: CampaignService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CampaignService>(CampaignService);
    jest.clearAllMocks();

    // Safe defaults
    mockPrisma.campaign.findFirst.mockResolvedValue(null);
    mockPrisma.campaign.findUnique.mockResolvedValue(mockCampaign);
    mockPrisma.campaign.findMany.mockResolvedValue([mockCampaign]);
    mockPrisma.campaign.create.mockResolvedValue(mockCampaign);
    mockPrisma.campaign.update.mockResolvedValue(mockCampaign);
    mockPrisma.campaign.delete.mockResolvedValue(mockCampaign);
    mockPrisma.userAcquisition.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);
    mockPrisma.funnelProgress.count.mockResolvedValue(0);
  });

  // ══════════════════════════════════════════════════════════
  // createCampaign()
  // ══════════════════════════════════════════════════════════
  describe('createCampaign()', () => {
    const dto = {
      name: 'Summer Campaign',
      utmSource: 'facebook',
      utmMedium: 'social',
      utmCampaign: 'summer-2026',
      utmContent: null,
    };

    it('creates a campaign successfully for a distributor', async () => {
      const result = await service.createCampaign(OWNER_UUID, 'DISTRIBUTOR', dto as any);

      expect(mockPrisma.campaign.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ownerUuid: OWNER_UUID,
            ownerType: 'DISTRIBUTOR',
            name: 'Summer Campaign',
          }),
        }),
      );
      expect(result.uuid).toBe(CAMPAIGN_UUID);
      expect(result.generatedUrl).toContain('utm_source=facebook');
    });

    it('creates a campaign for admin (ADMIN ownerType)', async () => {
      const adminCampaign = { ...mockCampaign, ownerType: 'ADMIN' as const };
      mockPrisma.campaign.create.mockResolvedValue(adminCampaign);

      const result = await service.createCampaign(OWNER_UUID, 'ADMIN', dto as any);

      expect(mockPrisma.campaign.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ ownerType: 'ADMIN' }),
        }),
      );
      expect(result.uuid).toBe(CAMPAIGN_UUID);
    });

    it('includes ref param in URL when distributorCode exists', async () => {
      const result = await service.createCampaign(OWNER_UUID, 'DISTRIBUTOR', dto as any);

      expect(result.generatedUrl).toContain('ref=NSI-RAH01');
    });

    it('throws ConflictException when UTM slug already exists for owner', async () => {
      mockPrisma.campaign.findFirst.mockResolvedValue(mockCampaign);

      await expect(
        service.createCampaign(OWNER_UUID, 'DISTRIBUTOR', dto as any),
      ).rejects.toThrow(ConflictException);
    });

    it('does not throw ConflictException when duplicate belongs to different owner', async () => {
      // findFirst with ownerUuid filter returns null (different owner)
      mockPrisma.campaign.findFirst.mockResolvedValue(null);

      await expect(
        service.createCampaign('different-owner', 'DISTRIBUTOR', dto as any),
      ).resolves.toBeDefined();
    });
  });

  // ══════════════════════════════════════════════════════════
  // listCampaigns()
  // ══════════════════════════════════════════════════════════
  describe('listCampaigns()', () => {
    it('returns campaigns for distributor filtered by ownerUuid', async () => {
      const result = await service.listCampaigns(OWNER_UUID, 'DISTRIBUTOR');

      expect(mockPrisma.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ownerUuid: OWNER_UUID } }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].generatedUrl).toContain('utm_source=facebook');
    });

    it('returns all campaigns for admin (no ownerUuid filter)', async () => {
      const result = await service.listCampaigns(OWNER_UUID, 'ADMIN');

      expect(mockPrisma.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
      expect(result).toHaveLength(1);
    });

    it('returns empty array when no campaigns exist', async () => {
      mockPrisma.campaign.findMany.mockResolvedValue([]);

      const result = await service.listCampaigns(OWNER_UUID, 'DISTRIBUTOR');

      expect(result).toHaveLength(0);
    });
  });

  // ══════════════════════════════════════════════════════════
  // getCampaign()
  // ══════════════════════════════════════════════════════════
  describe('getCampaign()', () => {
    it('returns campaign with analytics for owner', async () => {
      mockPrisma.userAcquisition.findMany.mockResolvedValue([
        { userUuid: USER_UUID },
      ]);
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.funnelProgress.count.mockResolvedValue(0);

      const result = await service.getCampaign(CAMPAIGN_UUID, OWNER_UUID, 'DISTRIBUTOR');

      expect(result.uuid).toBe(CAMPAIGN_UUID);
      expect(result.generatedUrl).toContain('utm_source=facebook');
      expect(result.analytics).toBeDefined();
      expect(result.analytics.clicks).toBe(1);
    });

    it('returns analytics with zero counts when no acquisitions', async () => {
      const result = await service.getCampaign(CAMPAIGN_UUID, OWNER_UUID, 'DISTRIBUTOR');

      expect(result.analytics.clicks).toBe(0);
      expect(result.analytics.signups).toBe(0);
    });

    it('throws NotFoundException when campaign not found', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(null);

      await expect(
        service.getCampaign(CAMPAIGN_UUID, OWNER_UUID, 'DISTRIBUTOR'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when distributor accesses another owner campaign', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({
        ...mockCampaign,
        ownerUuid: 'other-owner-uuid',
      });

      await expect(
        service.getCampaign(CAMPAIGN_UUID, OWNER_UUID, 'DISTRIBUTOR'),
      ).rejects.toThrow(NotFoundException);
    });

    it('admin can access any campaign regardless of ownerUuid', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({
        ...mockCampaign,
        ownerUuid: 'other-owner-uuid',
      });

      const result = await service.getCampaign(CAMPAIGN_UUID, OWNER_UUID, 'ADMIN');

      expect(result.uuid).toBe(CAMPAIGN_UUID);
    });
  });

  // ══════════════════════════════════════════════════════════
  // updateCampaign()
  // ══════════════════════════════════════════════════════════
  describe('updateCampaign()', () => {
    it('updates campaign name successfully', async () => {
      const dto = { name: 'Updated Campaign' };
      const updated = { ...mockCampaign, name: 'Updated Campaign' };
      mockPrisma.campaign.update.mockResolvedValue(updated);

      const result = await service.updateCampaign(CAMPAIGN_UUID, OWNER_UUID, 'DISTRIBUTOR', dto as any);

      expect(mockPrisma.campaign.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { uuid: CAMPAIGN_UUID }, data: dto }),
      );
      expect(result.generatedUrl).toBeDefined();
    });

    it('throws NotFoundException when campaign not found', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(null);

      await expect(
        service.updateCampaign(CAMPAIGN_UUID, OWNER_UUID, 'DISTRIBUTOR', {} as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when distributor tries to update another owner campaign', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({
        ...mockCampaign,
        ownerUuid: 'other-owner-uuid',
      });

      await expect(
        service.updateCampaign(CAMPAIGN_UUID, OWNER_UUID, 'DISTRIBUTOR', {} as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when changing UTM slug to one that already exists', async () => {
      const dto = { utmCampaign: 'existing-slug' };
      // findFirst returns a conflict (different campaign, same slug)
      mockPrisma.campaign.findFirst.mockResolvedValue({
        ...mockCampaign,
        uuid: 'other-campaign-uuid',
        utmCampaign: 'existing-slug',
      });

      await expect(
        service.updateCampaign(CAMPAIGN_UUID, OWNER_UUID, 'DISTRIBUTOR', dto as any),
      ).rejects.toThrow(ConflictException);
    });

    it('does not conflict-check when UTM slug unchanged', async () => {
      const dto = { utmCampaign: 'summer-2026' }; // same as existing

      await service.updateCampaign(CAMPAIGN_UUID, OWNER_UUID, 'DISTRIBUTOR', dto as any);

      // Should not check for conflict because slug hasn't changed
      expect(mockPrisma.campaign.findFirst).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════
  // deleteCampaign()
  // ══════════════════════════════════════════════════════════
  describe('deleteCampaign()', () => {
    it('deletes campaign successfully', async () => {
      const result = await service.deleteCampaign(CAMPAIGN_UUID, OWNER_UUID, 'DISTRIBUTOR');

      expect(mockPrisma.campaign.delete).toHaveBeenCalledWith({ where: { uuid: CAMPAIGN_UUID } });
      expect(result.message).toBe('Campaign deleted');
    });

    it('throws NotFoundException when campaign not found', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteCampaign(CAMPAIGN_UUID, OWNER_UUID, 'DISTRIBUTOR'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when distributor tries to delete another owner campaign', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({
        ...mockCampaign,
        ownerUuid: 'different-owner',
      });

      await expect(
        service.deleteCampaign(CAMPAIGN_UUID, OWNER_UUID, 'DISTRIBUTOR'),
      ).rejects.toThrow(NotFoundException);
    });

    it('admin can delete any campaign', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({
        ...mockCampaign,
        ownerUuid: 'any-owner',
      });

      const result = await service.deleteCampaign(CAMPAIGN_UUID, OWNER_UUID, 'ADMIN');

      expect(result.message).toBe('Campaign deleted');
    });
  });
});
