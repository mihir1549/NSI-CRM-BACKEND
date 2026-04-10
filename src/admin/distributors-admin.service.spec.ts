import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DistributorsAdminService } from './distributors-admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const DISTRIBUTOR_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ACTOR_UUID       = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const mockDistributor = {
  uuid: DISTRIBUTOR_UUID,
  fullName: 'Rahul Distributor',
  email: 'rahul@nsi.com',
  country: 'IN',
  distributorCode: 'NSI-RAH01',
  joinLinkActive: true,
  createdAt: new Date('2026-01-01'),
  role: 'DISTRIBUTOR',
  leadsDistributed: [],
};

const mockDistributorWithLeads = {
  ...mockDistributor,
  leadsDistributed: [
    {
      uuid: 'lead-1-uuid',
      status: 'HOT',
      phone: null,
      createdAt: new Date('2026-03-01'),
      updatedAt: new Date('2026-04-01'),
      user: {
        fullName: 'Test User',
        email: 'user@test.com',
        country: 'IN',
        profile: { phone: '+919999999999' },
      },
      activities: [],
    },
    {
      uuid: 'lead-2-uuid',
      status: 'MARK_AS_CUSTOMER',
      phone: null,
      createdAt: new Date('2026-02-01'),
      updatedAt: new Date('2026-04-01'),
      user: {
        fullName: 'Customer User',
        email: 'customer@test.com',
        country: 'US',
        profile: null,
      },
      activities: [{ followupAt: new Date('2026-04-10') }],
    },
  ],
};

// ─── Prisma mock ──────────────────────────────────────────────────────────────
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
};

const mockAudit = { log: jest.fn() };

const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: string) => {
    const cfg: Record<string, string> = {
      FRONTEND_URL: 'https://growithnsi.com',
    };
    return cfg[key] ?? defaultValue;
  }),
};

describe('DistributorsAdminService', () => {
  let service: DistributorsAdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DistributorsAdminService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<DistributorsAdminService>(DistributorsAdminService);
    jest.clearAllMocks();

    // Safe defaults
    mockPrisma.user.findUnique.mockResolvedValue(mockDistributor);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);
    mockPrisma.user.update.mockResolvedValue(mockDistributor);
    mockConfigService.get.mockImplementation((key: string, defaultValue?: string) => {
      const cfg: Record<string, string> = { FRONTEND_URL: 'https://growithnsi.com' };
      return cfg[key] ?? defaultValue;
    });
  });

  // ══════════════════════════════════════════════════════════
  // listDistributors()
  // ══════════════════════════════════════════════════════════
  describe('listDistributors()', () => {
    it('returns empty paginated result when no distributors', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      const result = await service.listDistributors({});

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('returns distributors with computed stats', async () => {
      const dist = {
        ...mockDistributor,
        leadsDistributed: [
          { uuid: 'l1', status: 'HOT', updatedAt: new Date() },
          { uuid: 'l2', status: 'MARK_AS_CUSTOMER', updatedAt: new Date() },
        ],
      };
      mockPrisma.user.findMany.mockResolvedValue([dist]);
      mockPrisma.user.count.mockResolvedValue(1);

      const result = await service.listDistributors({});

      expect(result.items).toHaveLength(1);
      expect(result.items[0].totalLeads).toBe(2);
      expect(result.items[0].hotLeads).toBe(1);
      expect(result.items[0].convertedLeads).toBe(1);
      expect(result.items[0].conversionRate).toBe('50.0%');
      expect(result.items[0].joinLink).toBe('https://growithnsi.com/join/NSI-RAH01');
    });

    it('filters by active status', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      await service.listDistributors({ status: 'active' });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ joinLinkActive: true }),
        }),
      );
    });

    it('filters by deactivated status', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      await service.listDistributors({ status: 'deactivated' });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ joinLinkActive: false }),
        }),
      );
    });

    it('applies search filter for name and email', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      await service.listDistributors({ search: 'rahul' });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ OR: expect.any(Array) }),
        }),
      );
    });

    it('supports pagination', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(50);

      const result = await service.listDistributors({ page: 3, limit: 10 });

      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(5);
    });

    it('sets joinLink to null when distributorCode is missing', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { ...mockDistributor, distributorCode: null, leadsDistributed: [] },
      ]);
      mockPrisma.user.count.mockResolvedValue(1);

      const result = await service.listDistributors({});

      expect(result.items[0].joinLink).toBeNull();
    });
  });

  // ══════════════════════════════════════════════════════════
  // getDistributorDetail()
  // ══════════════════════════════════════════════════════════
  describe('getDistributorDetail()', () => {
    it('returns full detail for a distributor', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockDistributorWithLeads);

      const result = await service.getDistributorDetail(DISTRIBUTOR_UUID);

      expect(result.uuid).toBe(DISTRIBUTOR_UUID);
      expect(result.totalLeads).toBe(2);
      expect(result.convertedLeads).toBe(1);
      expect(result.hotLeads).toBe(1);
      expect(result.conversionRate).toBe('50.0%');
      expect(result.joinLink).toBe('https://growithnsi.com/join/NSI-RAH01');
    });

    it('includes recent leads with correct fields', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockDistributorWithLeads);

      const result = await service.getDistributorDetail(DISTRIBUTOR_UUID);

      expect(result.recentLeads).toHaveLength(2);
      expect(result.recentLeads[0].uuid).toBe('lead-1-uuid');
      expect(result.recentLeads[0].userFullName).toBe('Test User');
      expect(result.recentLeads[0].phone).toBe('+919999999999'); // fallback to profile phone
    });

    it('includes followupAt from last activity', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockDistributorWithLeads);

      const result = await service.getDistributorDetail(DISTRIBUTOR_UUID);

      expect(result.recentLeads[1].followupAt).toBeInstanceOf(Date);
    });

    it('includes performanceAnalytics with funnelPath and leadsByCountry', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockDistributorWithLeads);

      const result = await service.getDistributorDetail(DISTRIBUTOR_UUID);

      const analytics = result.performanceAnalytics;
      expect(analytics.totalReferrals).toBe(2);
      expect(analytics.successfulConversions).toBe(1);
      expect(analytics.funnelPath.length).toBeGreaterThan(0);
      expect(analytics.leadsByCountry.length).toBeGreaterThan(0);
    });

    it('throws NotFoundException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getDistributorDetail(DISTRIBUTOR_UUID)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when user is not a DISTRIBUTOR', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockDistributor, role: 'USER' });

      await expect(service.getDistributorDetail(DISTRIBUTOR_UUID)).rejects.toThrow(NotFoundException);
    });

    it('returns 0.0% conversionRate when no leads', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockDistributor, leadsDistributed: [] });

      const result = await service.getDistributorDetail(DISTRIBUTOR_UUID);

      expect(result.conversionRate).toBe('0.0%');
    });
  });

  // ══════════════════════════════════════════════════════════
  // deactivateLink()
  // ══════════════════════════════════════════════════════════
  describe('deactivateLink()', () => {
    it('deactivates join link and calls audit', async () => {
      const result = await service.deactivateLink(DISTRIBUTOR_UUID, ACTOR_UUID, '127.0.0.1');

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uuid: DISTRIBUTOR_UUID },
          data: { joinLinkActive: false },
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUuid: ACTOR_UUID,
          action: 'DISTRIBUTOR_LINK_DEACTIVATED',
        }),
      );
      expect(result.message).toBe('Join link deactivated');
    });

    it('throws NotFoundException when distributor not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.deactivateLink(DISTRIBUTOR_UUID, ACTOR_UUID, '127.0.0.1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when user is not a DISTRIBUTOR', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockDistributor, role: 'USER' });

      await expect(
        service.deactivateLink(DISTRIBUTOR_UUID, ACTOR_UUID, '127.0.0.1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // activateLink()
  // ══════════════════════════════════════════════════════════
  describe('activateLink()', () => {
    it('activates join link and calls audit', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockDistributor, joinLinkActive: false });

      const result = await service.activateLink(DISTRIBUTOR_UUID, ACTOR_UUID, '127.0.0.1');

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uuid: DISTRIBUTOR_UUID },
          data: { joinLinkActive: true },
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUuid: ACTOR_UUID,
          action: 'DISTRIBUTOR_LINK_ACTIVATED',
        }),
      );
      expect(result.message).toBe('Join link activated');
    });

    it('throws NotFoundException when distributor not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.activateLink(DISTRIBUTOR_UUID, ACTOR_UUID, '127.0.0.1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when user role is not DISTRIBUTOR', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockDistributor, role: 'ADMIN' });

      await expect(
        service.activateLink(DISTRIBUTOR_UUID, ACTOR_UUID, '127.0.0.1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
