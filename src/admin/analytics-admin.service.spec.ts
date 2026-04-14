import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AnalyticsAdminService } from './analytics-admin.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const DISTRIBUTOR_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_UUID        = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

// ─── Prisma mock ──────────────────────────────────────────────────────────────
const mockPrisma = {
  user: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  lead: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  payment: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  userProfile: {
    count: jest.fn(),
  },
  funnelProgress: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  leadActivity: {
    findMany: jest.fn(),
  },
  userAcquisition: {
    findMany: jest.fn(),
  },
};

describe('AnalyticsAdminService', () => {
  let service: AnalyticsAdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsAdminService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AnalyticsAdminService>(AnalyticsAdminService);
    jest.resetAllMocks();

    // Safe defaults — all counts return 0, arrays return []
    mockPrisma.user.count.mockResolvedValue(0);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.lead.count.mockResolvedValue(0);
    mockPrisma.lead.findMany.mockResolvedValue([]);
    mockPrisma.payment.count.mockResolvedValue(0);
    mockPrisma.payment.findMany.mockResolvedValue([]);
    mockPrisma.userProfile.count.mockResolvedValue(0);
    mockPrisma.funnelProgress.count.mockResolvedValue(0);
    mockPrisma.funnelProgress.findMany.mockResolvedValue([]);
    mockPrisma.leadActivity.findMany.mockResolvedValue([]);
    mockPrisma.userAcquisition.findMany.mockResolvedValue([]);
  });

  // ══════════════════════════════════════════════════════════
  // getDashboard()
  // ══════════════════════════════════════════════════════════
  describe('getDashboard()', () => {
    it('returns dashboard with zeros for empty date range', async () => {
      const result = await service.getDashboard({});

      expect(result.overview.totalUsers).toBe(0);
      expect(result.overview.hotLeads).toBe(0);
      expect(result.overview.customers).toBe(0);
      expect(result.overview.distributors).toBe(0);
      expect(result.decisionSplit.yesPercent).toBe('0.0%');
      expect(result.funnelStages).toHaveLength(5);
    });

    it('calculates decision split percentages correctly', async () => {
      // decisionYesCount = 3, decisionNoCount = 1 → yes%=75%
      mockPrisma.funnelProgress.count
        .mockResolvedValueOnce(0) // paymentCompleted current
        .mockResolvedValueOnce(3) // decisionAnswer YES
        .mockResolvedValueOnce(1) // decisionAnswer NO
        .mockResolvedValueOnce(0) // funnel paymentDone
        .mockResolvedValueOnce(0); // funnel decisionYes

      const result = await service.getDashboard({});

      expect(result.decisionSplit.yes).toBe(3);
      expect(result.decisionSplit.no).toBe(1);
      expect(result.decisionSplit.yesPercent).toBe('75.0%');
    });

    it('calculates growth percentages when previous period has data', async () => {
      // user.count: [current=10, previous=5, ...rest=0]
      mockPrisma.user.count
        .mockResolvedValueOnce(10)  // totalUsers current
        .mockResolvedValueOnce(5)   // totalUsers previous
        .mockResolvedValueOnce(0)   // customers current
        .mockResolvedValueOnce(0)   // customers previous
        .mockResolvedValueOnce(0)   // distributors current
        .mockResolvedValueOnce(0)   // distributors previous
        .mockResolvedValueOnce(0)   // funnelRegistered
        .mockResolvedValueOnce(0);  // funnelEmailVerified

      const result = await service.getDashboard({});

      expect(result.overview.totalUsers).toBe(10);
      expect(result.overview.totalUsersGrowth).toBe(100); // (10-5)/5 * 100 = 100%
    });

    it('includes all 5 funnel stages in correct order', async () => {
      const result = await service.getDashboard({});

      const stageNames = result.funnelStages.map((s: { stage: string }) => s.stage);
      expect(stageNames).toEqual([
        'Registered',
        'Email Verified',
        'Phone Verified',
        'Payment Done',
        'Decision YES',
      ]);
    });

    it('throws BadRequestException when from > to', async () => {
      await expect(
        service.getDashboard({ from: '2026-12-01', to: '2026-01-01' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when date range exceeds 5 years', async () => {
      await expect(
        service.getDashboard({ from: '2015-01-01', to: '2026-01-01' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // getFunnelAnalytics()
  // ══════════════════════════════════════════════════════════
  describe('getFunnelAnalytics()', () => {
    it('returns funnel stages with zero counts', async () => {
      const result = await service.getFunnelAnalytics({});

      expect(result.stages).toHaveLength(5);
      expect(result.stages[0].stage).toBe('Registered');
      expect(result.stages[0].count).toBe(0);
      expect(result.stages[0].dropoffFromPrevious).toBe(0);
      expect(result.grouping).toMatch(/day|week|month/);
    });

    it('calculates drop-off correctly between stages', async () => {
      // registered=100, emailVerified=80, phoneVerified=60, paymentDone=40, decisionYes=20
      mockPrisma.user.count
        .mockResolvedValueOnce(100)  // registered
        .mockResolvedValueOnce(80);  // emailVerified
      mockPrisma.userProfile.count.mockResolvedValueOnce(60);
      mockPrisma.funnelProgress.count
        .mockResolvedValueOnce(40)  // paymentDone
        .mockResolvedValueOnce(20); // decisionYes

      const result = await service.getFunnelAnalytics({});

      const stages = result.stages;
      expect(stages[0].count).toBe(100);
      expect(stages[1].dropoffFromPrevious).toBe(20); // 100 - 80
      expect(stages[1].dropoffPercent).toBe('20.0%');
      expect(stages[4].conversionFromStart).toBe('20.0%'); // 20/100
    });

    it('uses day grouping for ≤30 day range', async () => {
      const result = await service.getFunnelAnalytics({
        from: '2026-04-01',
        to: '2026-04-10',
      });

      expect(result.grouping).toBe('day');
    });

    it('uses month grouping for >180 day range', async () => {
      const result = await service.getFunnelAnalytics({
        from: '2025-01-01',
        to: '2026-01-01',
      });

      expect(result.grouping).toBe('month');
    });

    it('throws BadRequestException when from > to', async () => {
      await expect(
        service.getFunnelAnalytics({ from: '2026-04-10', to: '2026-04-01' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // getRevenueAnalytics()
  // ══════════════════════════════════════════════════════════
  describe('getRevenueAnalytics()', () => {
    it('returns zero revenue when no payments', async () => {
      const result = await service.getRevenueAnalytics({});

      expect(result.totalRevenue).toBe(0);
      expect(result.byCountry).toHaveLength(0);
      expect(result.chart).toHaveLength(0);
      expect(result.byType.commitmentFee).toBe(0);
    });

    it('sums revenue by payment type correctly', async () => {
      const payments = [
        { finalAmount: 5000, paymentType: 'COMMITMENT_FEE', createdAt: new Date('2026-04-01'), user: { country: 'IN' } },
        { finalAmount: 999, paymentType: 'LMS_COURSE', createdAt: new Date('2026-04-02'), user: { country: 'US' } },
        { finalAmount: 1500, paymentType: 'DISTRIBUTOR_SUB', createdAt: new Date('2026-04-03'), user: { country: 'IN' } },
      ];
      mockPrisma.payment.findMany
        .mockResolvedValueOnce(payments)    // current
        .mockResolvedValueOnce([]);         // previous

      const result = await service.getRevenueAnalytics({});

      expect(result.totalRevenue).toBe(7499);
      expect(result.byType.commitmentFee).toBe(5000);
      expect(result.byType.lmsCourse).toBe(999);
      expect(result.byType.distributorSubscription).toBe(1500);
    });

    it('groups revenue by country correctly', async () => {
      const payments = [
        { finalAmount: 5000, paymentType: 'COMMITMENT_FEE', createdAt: new Date('2026-04-01'), user: { country: 'IN' } },
        { finalAmount: 1000, paymentType: 'LMS_COURSE', createdAt: new Date('2026-04-01'), user: { country: 'IN' } },
        { finalAmount: 3000, paymentType: 'COMMITMENT_FEE', createdAt: new Date('2026-04-01'), user: { country: 'US' } },
      ];
      mockPrisma.payment.findMany
        .mockResolvedValueOnce(payments)
        .mockResolvedValueOnce([]);

      const result = await service.getRevenueAnalytics({});

      expect(result.byCountry).toHaveLength(2);
      const india = result.byCountry.find((c: { country: string }) => c.country === 'IN');
      expect(india?.revenue).toBe(6000);
    });

    it('calculates revenue growth vs previous period', async () => {
      mockPrisma.payment.findMany
        .mockResolvedValueOnce([{ finalAmount: 10000, paymentType: 'COMMITMENT_FEE', createdAt: new Date(), user: { country: 'IN' } }])
        .mockResolvedValueOnce([{ finalAmount: 5000 }]);

      const result = await service.getRevenueAnalytics({});

      expect(result.totalRevenue).toBe(10000);
      expect(result.totalRevenueGrowth).toBe(100); // (10000-5000)/5000*100
    });

    it('throws BadRequestException for invalid date range', async () => {
      await expect(
        service.getRevenueAnalytics({ from: '2026-06-01', to: '2026-01-01' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // getLeadsAnalytics()
  // ══════════════════════════════════════════════════════════
  describe('getLeadsAnalytics()', () => {
    it('returns zero counts when no leads', async () => {
      const result = await service.getLeadsAnalytics({});

      expect(result.totalLeads).toBe(0);
      expect(result.byStatus.new).toBe(0);
      expect(result.bySource.direct).toBe(0);
      expect(result.chart).toHaveLength(0);
    });

    it('correctly categorizes leads by status', async () => {
      const leads = [
        { status: 'NEW', distributorUuid: null, createdAt: new Date('2026-04-01') },
        { status: 'HOT', distributorUuid: DISTRIBUTOR_UUID, createdAt: new Date('2026-04-01') },
        { status: 'MARK_AS_CUSTOMER', distributorUuid: null, createdAt: new Date('2026-04-01') },
        { status: 'WARM', distributorUuid: DISTRIBUTOR_UUID, createdAt: new Date('2026-04-01') },
        { status: 'CONTACTED', distributorUuid: null, createdAt: new Date('2026-04-01') },
        { status: 'FOLLOWUP', distributorUuid: null, createdAt: new Date('2026-04-01') },
        { status: 'NURTURE', distributorUuid: null, createdAt: new Date('2026-04-01') },
        { status: 'LOST', distributorUuid: null, createdAt: new Date('2026-04-01') },
      ];
      mockPrisma.lead.findMany.mockResolvedValue(leads);

      const result = await service.getLeadsAnalytics({});

      expect(result.totalLeads).toBe(8);
      expect(result.byStatus.new).toBe(1);
      expect(result.byStatus.hot).toBe(1);
      expect(result.byStatus.converted).toBe(1);
      expect(result.bySource.direct).toBe(6);
      expect(result.bySource.viaDistributor).toBe(2);
    });

    it('includes todayFollowups count', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([]);
      mockPrisma.leadActivity.findMany.mockResolvedValue([
        { leadUuid: 'lead-1' },
        { leadUuid: 'lead-2' },
      ]);

      const result = await service.getLeadsAnalytics({});

      expect(result.todayFollowups).toBe(2);
    });

    it('throws BadRequestException for invalid date range', async () => {
      await expect(
        service.getLeadsAnalytics({ from: '2026-04-10', to: '2026-01-01' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // getUtmAnalytics()
  // ══════════════════════════════════════════════════════════
  describe('getUtmAnalytics()', () => {
    it('returns empty arrays when no leads in range', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([]);

      const result = await service.getUtmAnalytics({});

      expect(result.bySource).toHaveLength(0);
      expect(result.byMedium).toHaveLength(0);
      expect(result.byCampaign).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('builds UTM breakdown from acquisition data', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([{ userUuid: USER_UUID }]);
      mockPrisma.userAcquisition.findMany.mockResolvedValue([
        { utmSource: 'facebook', utmMedium: 'social', utmCampaign: 'summer' },
        { utmSource: null, utmMedium: null, utmCampaign: null },
      ]);

      const result = await service.getUtmAnalytics({});

      expect(result.total).toBe(1);
      expect(result.bySource.some((s: { source: string }) => s.source === 'facebook')).toBe(true);
      expect(result.bySource.some((s: { source: string }) => s.source === 'direct')).toBe(true);
    });

    it('filters by distributorUuid when provided', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([]);

      await service.getUtmAnalytics({ distributorUuid: DISTRIBUTOR_UUID });

      expect(mockPrisma.lead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ distributorUuid: DISTRIBUTOR_UUID }),
        }),
      );
    });

    it('throws BadRequestException for invalid date range', async () => {
      await expect(
        service.getUtmAnalytics({ from: '2026-06-01', to: '2026-01-01' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // getDistributorsAnalytics()
  // ══════════════════════════════════════════════════════════
  describe('getDistributorsAnalytics()', () => {
    it('returns zeros when no distributors exist', async () => {
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.lead.findMany.mockResolvedValue([]);

      const result = await service.getDistributorsAnalytics({});

      expect(result.totalDistributors).toBe(0);
      expect(result.activeThisMonth).toBe(0);
      expect(result.avgLeadsPerDistributor).toBe(0);
      expect(result.avgConversionRate).toBe('0.0%');
      expect(result.topDistributors).toHaveLength(0);
    });

    it('calculates distributor stats from leads', async () => {
      const dist = {
        uuid: DISTRIBUTOR_UUID,
        fullName: 'Rahul',
        distributorCode: 'NSI-RAH01',
        leadsDistributed: [
          { status: 'HOT', updatedAt: new Date() },
          { status: 'MARK_AS_CUSTOMER', updatedAt: new Date() },
        ],
      };
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.user.findMany.mockResolvedValue([dist]);
      mockPrisma.lead.findMany.mockResolvedValue([]);

      const result = await service.getDistributorsAnalytics({});

      expect(result.totalDistributors).toBe(1);
      expect(result.activeThisMonth).toBe(1);
      expect(result.topDistributors[0].totalLeads).toBe(2);
      expect(result.topDistributors[0].convertedLeads).toBe(1);
      expect(result.topDistributors[0].conversionRate).toBe('50.0%');
    });

    it('includes funnel path from distributor leads', async () => {
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.lead.findMany.mockResolvedValue([
        { status: 'HOT' },
        { status: 'HOT' },
        { status: 'MARK_AS_CUSTOMER' },
      ]);

      const result = await service.getDistributorsAnalytics({});

      expect(result.funnelPath.some((f: { stage: string; count: number }) => f.stage === 'HOT' && f.count === 2)).toBe(true);
    });

    it('throws BadRequestException for invalid date range', async () => {
      await expect(
        service.getDistributorsAnalytics({ from: '2026-06-01', to: '2026-01-01' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
