import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AnalyticsAdminService } from './analytics-admin.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const DISTRIBUTOR_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

// ─── Prisma mock ──────────────────────────────────────────────────────────────
const mockPrisma = {
  user: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  lead: {
    count: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn(),
  },
  payment: {
    count: jest.fn(),
    findMany: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  },
  $queryRaw: jest.fn(),
  userProfile: {
    count: jest.fn(),
  },
  funnelProgress: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  leadActivity: {
    findMany: jest.fn(),
    groupBy: jest.fn(),
  },
  userAcquisition: {
    findMany: jest.fn(),
    groupBy: jest.fn(),
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
    mockPrisma.payment.aggregate.mockResolvedValue({
      _sum: { finalAmount: null },
    });
    mockPrisma.payment.groupBy.mockResolvedValue([]);
    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockPrisma.userProfile.count.mockResolvedValue(0);
    mockPrisma.funnelProgress.count.mockResolvedValue(0);
    mockPrisma.funnelProgress.findMany.mockResolvedValue([]);
    mockPrisma.lead.groupBy.mockResolvedValue([]);
    mockPrisma.leadActivity.findMany.mockResolvedValue([]);
    mockPrisma.leadActivity.groupBy.mockResolvedValue([]);
    mockPrisma.userAcquisition.findMany.mockResolvedValue([]);
    mockPrisma.userAcquisition.groupBy.mockResolvedValue([]);
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
      expect(result.decisionSplit.yesPercent).toBe(0);
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
      expect(result.decisionSplit.yesPercent).toBe(75);
    });

    it('calculates growth percentages when previous period has data', async () => {
      // user.count: [current=10, previous=5, ...rest=0]
      mockPrisma.user.count
        .mockResolvedValueOnce(10) // totalUsers current
        .mockResolvedValueOnce(5) // totalUsers previous
        .mockResolvedValueOnce(0) // customers current
        .mockResolvedValueOnce(0) // customers previous
        .mockResolvedValueOnce(0) // distributors current
        .mockResolvedValueOnce(0) // distributors previous
        .mockResolvedValueOnce(0) // funnelRegistered
        .mockResolvedValueOnce(0); // funnelEmailVerified

      const result = await service.getDashboard({});

      expect(result.overview.totalUsers).toBe(10);
      expect(result.overview.totalUsersGrowth).toBe(100); // (10-5)/5 * 100 = 100%
    });

    it('includes all 5 funnel stages in correct order', async () => {
      const result = await service.getDashboard({});

      const stageNames = result.funnelStages.map(
        (s: { stage: string }) => s.stage,
      );
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

    it('returns 100 growth when previous period is 0 and current > 0', async () => {
      mockPrisma.user.count
        .mockResolvedValueOnce(5) // totalUsers current
        .mockResolvedValueOnce(0) // totalUsers previous (zero → 100% growth)
        .mockResolvedValue(0);

      const result = await service.getDashboard({});

      expect(result.overview.totalUsersGrowth).toBe(100);
    });

    it('returns 0 growth when both current and previous are 0', async () => {
      const result = await service.getDashboard({});

      expect(result.overview.totalUsersGrowth).toBe(0);
    });

    it('calculates growth to 1 decimal place for non-integer results', async () => {
      mockPrisma.user.count
        .mockResolvedValueOnce(5) // current
        .mockResolvedValueOnce(3) // previous → (5-3)/3 * 100 = 66.7%
        .mockResolvedValue(0);

      const result = await service.getDashboard({});

      expect(result.overview.totalUsersGrowth).toBe(66.7);
    });

    it('returns null devices and topBrowsers when no acquisition data exists', async () => {
      // groupBy returns [] by default (set in beforeEach)
      const result = await service.getDashboard({});

      expect(result.devices).toEqual({ mobile: 0, desktop: 0, tablet: 0 });
      expect(result.topBrowsers).toEqual([]);
    });

    it('returns device breakdown with correct counts', async () => {
      mockPrisma.userAcquisition.groupBy
        .mockResolvedValueOnce([
          { deviceType: 'MOBILE', _count: { deviceType: 65 } },
          { deviceType: 'DESKTOP', _count: { deviceType: 30 } },
          { deviceType: 'TABLET', _count: { deviceType: 5 } },
        ])
        .mockResolvedValueOnce([]); // no browser data

      const result = await service.getDashboard({});

      expect(result.devices).not.toBeNull();
      expect(result.devices!.mobile).toBe(65);
      expect(result.devices!.desktop).toBe(30);
      expect(result.devices!.tablet).toBe(5);
      expect(result.topBrowsers).toEqual([]);
    });

    it('calculates browser percentages correctly and appends Other', async () => {
      mockPrisma.userAcquisition.groupBy
        .mockResolvedValueOnce([]) // no device data
        .mockResolvedValueOnce([
          { browser: 'Chrome', _count: { browser: 72 } },
          { browser: 'Safari', _count: { browser: 18 } },
          { browser: 'Firefox', _count: { browser: 5 } },
          { browser: 'Edge', _count: { browser: 5 } },
        ]);

      const result = await service.getDashboard({});

      // total = 100, Chrome = 72%, Safari = 18%, Firefox = 5%, Other = 5%
      expect(result.topBrowsers).not.toBeNull();
      expect(result.topBrowsers).toHaveLength(4);
      expect(result.topBrowsers![0]).toEqual({
        browser: 'Chrome',
        percentage: 72,
      });
      expect(result.topBrowsers![1]).toEqual({
        browser: 'Safari',
        percentage: 18,
      });
      expect(result.topBrowsers![2]).toEqual({
        browser: 'Firefox',
        percentage: 5,
      });
      expect(result.topBrowsers![3]).toEqual({
        browser: 'Other',
        percentage: 5,
      });
    });

    it('omits Other browser entry when top 3 accounts for 100%', async () => {
      mockPrisma.userAcquisition.groupBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { browser: 'Chrome', _count: { browser: 50 } },
          { browser: 'Safari', _count: { browser: 30 } },
          { browser: 'Firefox', _count: { browser: 20 } },
        ]);

      const result = await service.getDashboard({});

      // 50+30+20 = 100%, no Other
      expect(result.topBrowsers).toHaveLength(3);
      const labels = result.topBrowsers!.map((b) => b.browser);
      expect(labels).not.toContain('Other');
    });

    it('calculates funnel summary with correct values', async () => {
      // funnelRegistered = user.count call #7 = 100
      mockPrisma.user.count
        .mockResolvedValueOnce(0) // totalUsers current
        .mockResolvedValueOnce(0) // prevTotalUsers
        .mockResolvedValueOnce(0) // customers current
        .mockResolvedValueOnce(0) // prevCustomers
        .mockResolvedValueOnce(0) // distributors current
        .mockResolvedValueOnce(0) // prevDistributors
        .mockResolvedValueOnce(100) // funnelRegistered → totalFunnelStarts
        .mockResolvedValueOnce(0); // funnelEmailVerified

      // funnelPaymentDone = funnelProgress.count call #4 = 40
      mockPrisma.funnelProgress.count
        .mockResolvedValueOnce(0) // paymentsCompletedCount
        .mockResolvedValueOnce(0) // decisionYesCount
        .mockResolvedValueOnce(0) // decisionNoCount
        .mockResolvedValueOnce(40) // funnelPaymentDone → completedPayment
        .mockResolvedValueOnce(0); // funnelDecisionYes

      // decidedYesLeads = lead.count call #3 = 20, decidedNoLeads = call #4 = 10
      mockPrisma.lead.count
        .mockResolvedValueOnce(0) // hotLeads current
        .mockResolvedValueOnce(0) // prevHotLeads
        .mockResolvedValueOnce(20) // decidedYesLeads
        .mockResolvedValueOnce(10); // decidedNoLeads

      const result = await service.getDashboard({});

      expect(result.funnelSummary.totalFunnelStarts).toBe(100);
      expect(result.funnelSummary.completedPayment).toBe(40);
      expect(result.funnelSummary.decidedYes).toBe(20);
      expect(result.funnelSummary.decidedNo).toBe(10);
      // overallConversionRate = (20 / 100) * 100 = 20.0
      expect(result.funnelSummary.overallConversionRate).toBe(20);
    });

    it('returns 0 overallConversionRate when totalFunnelStarts is 0', async () => {
      const result = await service.getDashboard({});

      expect(result.funnelSummary.totalFunnelStarts).toBe(0);
      expect(result.funnelSummary.overallConversionRate).toBe(0);
    });

    // ── Lifetime totals ────────────────────────────────────────────────────
    it('returns null period and top-level lifetime totals when no params', async () => {
      // First batch: 8 user.count calls (all default 0)
      // Lifetime batch: user.count call 9 (lifetimeUsers), 10 (lifetimeDistributors)
      // Lifetime batch: lead.count call 5 (lifetimeLeads), 6 (lifetimeCustomers)
      // Lifetime batch: payment.aggregate call 1 (lifetimeRevenue)
      mockPrisma.user.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0) // 1-2: totalUsers, prev
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0) // 3-4: customers, prev
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0) // 5-6: distributors, prev
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0) // 7-8: funnelRegistered, funnelEmailVerified
        .mockResolvedValueOnce(247) // 9: lifetimeUsers
        .mockResolvedValueOnce(12); // 10: lifetimeDistributors

      mockPrisma.lead.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0) // 1-2: hotLeads, prev
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0) // 3-4: decidedYes, decidedNo
        .mockResolvedValueOnce(189) // 5: lifetimeLeads
        .mockResolvedValueOnce(34); // 6: lifetimeCustomers

      mockPrisma.payment.aggregate.mockResolvedValueOnce({
        _sum: { finalAmount: 485000 },
      }); // lifetime revenue

      const result = await service.getDashboard({});

      expect(result.totalUsers).toBe(247);
      expect(result.totalLeads).toBe(189);
      expect(result.totalCustomers).toBe(34);
      expect(result.totalRevenue).toBe(485000);
      expect(result.totalDistributors).toBe(12);
      expect(result.period).toBeNull();
      // Existing backward-compat fields still present
      expect(result.overview).toBeDefined();
      expect(result.funnelStages).toHaveLength(5);
    });

    // ── Period object ──────────────────────────────────────────────────────
    it('returns populated period object with growth when from/to provided', async () => {
      // After Fix 6, batch-3 no longer duplicates pUsers/pDistributors —
      // they reuse batch-1 totalUsers/distributors. Call order in batch 1:
      //   1: totalUsers=42   2: prevTotalUsers=36   3: customers(user)=0   4: prev=0
      //   5: distributors=3  6: prevDistributors=2  7: funnelReg=0         8: funnelEmailVer=0
      // Batch 2:
      //   9: lifetimeUsers=0 10: lifetimeDistributors=0
      mockPrisma.user.count
        .mockResolvedValueOnce(42)
        .mockResolvedValueOnce(36) // 1-2: totalUsers / prevTotalUsers (= pUsers / prevPUsers)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0) // 3-4: customers / prev
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(2) // 5-6: distributors / prev (= pDistributors / prev)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0) // 7-8: funnelRegistered / funnelEmailVerified
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0); // 9-10: lifetime

      // lead.count call order:
      //   1-4: first batch (hotLeads, prev, decidedYes, decidedNo = all 0)
      //   5: lifetimeLeads (0), 6: lifetimeCustomers (0)
      //   7: pLeads=31, 8: prevPLeads=25
      //   9: pCustomers=8, 10: prevPCustomers=8 (equal → growth 0)
      mockPrisma.lead.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0) // 1-4
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0) // 5-6: lifetime
        .mockResolvedValueOnce(31)
        .mockResolvedValueOnce(25) // 7-8: pLeads, prevPLeads
        .mockResolvedValueOnce(8)
        .mockResolvedValueOnce(8); // 9-10: pCustomers (equal)

      // payment.aggregate call order:
      //   1: lifetime (null), 2: pRevenue(72000), 3: prevPRevenue(60000)
      mockPrisma.payment.aggregate
        .mockResolvedValueOnce({ _sum: { finalAmount: null } })
        .mockResolvedValueOnce({ _sum: { finalAmount: 72000 } })
        .mockResolvedValueOnce({ _sum: { finalAmount: 60000 } });

      const result = await service.getDashboard({
        from: '2026-04-01',
        to: '2026-04-13',
      });

      expect(result.period).not.toBeNull();
      expect(result.period!.users).toBe(42);
      expect(result.period!.leads).toBe(31);
      expect(result.period!.customers).toBe(8);
      expect(result.period!.revenue).toBe(72000);
      expect(result.period!.distributors).toBe(3);
      // growth.users: (42-36)/36 * 100 = 16.666... → 16.7
      expect(result.period!.growth.users).toBe(16.7);
      // growth.leads: (31-25)/25 * 100 = 24.0
      expect(result.period!.growth.leads).toBe(24);
      // growth.customers: equal → 0
      expect(result.period!.growth.customers).toBe(0);
      // growth.revenue: (72000-60000)/60000 * 100 = 20
      expect(result.period!.growth.revenue).toBe(20);
      // growth.distributors: (3-2)/2 * 100 = 50
      expect(result.period!.growth.distributors).toBe(50);
      // period.from / period.to are ISO strings
      expect(typeof result.period!.from).toBe('string');
      expect(typeof result.period!.to).toBe('string');
      // backward-compat fields intact
      expect(result.overview).toBeDefined();
      expect(result.funnelStages).toHaveLength(5);
    });

    it('period growth returns 100 when previous period count is 0 and current > 0', async () => {
      // Fix 6: pUsers = totalUsers (first user.count call).
      mockPrisma.user.count
        .mockResolvedValueOnce(5) // totalUsers (= pUsers)
        .mockResolvedValueOnce(0) // prevTotalUsers (= prevPUsers)
        .mockResolvedValue(0); // everything else

      const result = await service.getDashboard({
        from: '2026-04-01',
        to: '2026-04-13',
      });

      expect(result.period!.growth.users).toBe(100);
    });

    it('period revenue uses Payment aggregate sum', async () => {
      mockPrisma.payment.aggregate
        .mockResolvedValueOnce({ _sum: { finalAmount: null } }) // lifetime
        .mockResolvedValueOnce({ _sum: { finalAmount: 99000 } }) // period current
        .mockResolvedValueOnce({ _sum: { finalAmount: null } }); // period previous (null = 0)

      const result = await service.getDashboard({
        from: '2026-04-01',
        to: '2026-04-13',
      });

      expect(result.period!.revenue).toBe(99000);
      expect(result.period!.growth.revenue).toBe(100); // prev=0, current>0 → 100
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
      expect(result.grouping).toBeNull();
    });

    it('calculates drop-off correctly between stages', async () => {
      // registered=100, emailVerified=80, phoneVerified=60, paymentDone=40, decisionYes=20
      mockPrisma.user.count
        .mockResolvedValueOnce(100) // registered
        .mockResolvedValueOnce(80); // emailVerified
      mockPrisma.userProfile.count.mockResolvedValueOnce(60);
      mockPrisma.funnelProgress.count
        .mockResolvedValueOnce(40) // paymentDone
        .mockResolvedValueOnce(20); // decisionYes

      const result = await service.getFunnelAnalytics({});

      const stages = result.stages;
      expect(stages[0].count).toBe(100);
      expect(stages[1].dropoffFromPrevious).toBe(20); // 100 - 80
      expect(stages[1].dropoffPercent).toBe(20);
      expect(stages[4].conversionFromStart).toBe(20); // 20/100
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
      expect(result.chart.length).toBeGreaterThan(0);
      expect(result.chart.every(c => c.revenue === 0)).toBe(true);
      expect(result.byType.commitmentFee).toBe(0);
    });

    it('sums revenue by payment type correctly', async () => {
      mockPrisma.payment.groupBy.mockResolvedValueOnce([
        { paymentType: 'COMMITMENT_FEE', _sum: { finalAmount: 5000 } },
        { paymentType: 'LMS_COURSE', _sum: { finalAmount: 999 } },
        { paymentType: 'DISTRIBUTOR_SUB', _sum: { finalAmount: 1500 } },
      ]);

      const result = await service.getRevenueAnalytics({});

      expect(result.totalRevenue).toBe(7499);
      expect(result.byType.commitmentFee).toBe(5000);
      expect(result.byType.lmsCourse).toBe(999);
      expect(result.byType.distributorSubscription).toBe(1500);
    });

    it('groups revenue by country correctly', async () => {
      // $queryRaw is called twice: first for byCountry, then for chart.
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          { country: 'IN', revenue: 6000n },
          { country: 'US', revenue: 3000n },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.getRevenueAnalytics({});

      expect(result.byCountry).toHaveLength(2);
      const india = result.byCountry.find(
        (c: { country: string }) => c.country === 'IN',
      );
      expect(india?.revenue).toBe(6000);
    });

    it('calculates revenue growth vs previous period', async () => {
      mockPrisma.payment.groupBy.mockResolvedValueOnce([
        { paymentType: 'COMMITMENT_FEE', _sum: { finalAmount: 10000 } },
      ]);
      mockPrisma.payment.aggregate.mockResolvedValueOnce({
        _sum: { finalAmount: 5000 },
      });

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
      expect(result.chart.length).toBeGreaterThan(0);
      expect(result.chart.every(c => c.newLeads === 0 && c.converted === 0)).toBe(true);
    });

    it('correctly categorizes leads by status', async () => {
      // After the SQL-aggregation refactor, leads are grouped by status in DB.
      mockPrisma.lead.groupBy.mockResolvedValueOnce([
        { status: 'NEW', _count: { uuid: 1 } },
        { status: 'HOT', _count: { uuid: 1 } },
        { status: 'MARK_AS_CUSTOMER', _count: { uuid: 1 } },
        { status: 'WARM', _count: { uuid: 1 } },
        { status: 'CONTACTED', _count: { uuid: 1 } },
        { status: 'FOLLOWUP', _count: { uuid: 1 } },
        { status: 'NURTURE', _count: { uuid: 1 } },
        { status: 'LOST', _count: { uuid: 1 } },
      ]);
      // $queryRaw fires twice: first for bySource (direct vs viaDistributor),
      // then for the chart buckets.
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          { source: 'direct', count: 6n },
          { source: 'viaDistributor', count: 2n },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.getLeadsAnalytics({});

      expect(result.totalLeads).toBe(8);
      expect(result.byStatus.new).toBe(1);
      expect(result.byStatus.hot).toBe(1);
      expect(result.byStatus.converted).toBe(1);
      expect(result.bySource.direct).toBe(6);
      expect(result.bySource.viaDistributor).toBe(2);
    });

    it('includes todayFollowups count', async () => {
      // groupBy(leadUuid).length = count of distinct followup leads today.
      mockPrisma.leadActivity.groupBy.mockResolvedValueOnce([
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
      // lead.count default is 0 → short-circuit returns empty arrays.
      const result = await service.getUtmAnalytics({});

      expect(result.bySource).toHaveLength(0);
      expect(result.byMedium).toHaveLength(0);
      expect(result.byCampaign).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('builds UTM breakdown from acquisition data', async () => {
      mockPrisma.lead.count.mockResolvedValue(1);
      // Three userAcquisition.groupBy calls (source/medium/campaign).
      mockPrisma.userAcquisition.groupBy
        .mockResolvedValueOnce([
          { utmSource: 'facebook', _count: { uuid: 1 } },
          { utmSource: null, _count: { uuid: 1 } },
        ])
        .mockResolvedValueOnce([
          { utmMedium: 'social', _count: { uuid: 1 } },
          { utmMedium: null, _count: { uuid: 1 } },
        ])
        .mockResolvedValueOnce([
          { utmCampaign: 'summer', _count: { uuid: 1 } },
          { utmCampaign: null, _count: { uuid: 1 } },
        ]);

      const result = await service.getUtmAnalytics({});

      expect(result.total).toBe(1);
      expect(
        result.bySource.some((s) => s.source === 'facebook'),
      ).toBe(true);
      expect(result.bySource.some((s) => s.source === 'direct')).toBe(true);
    });

    it('filters by distributorUuid when provided', async () => {
      mockPrisma.lead.count.mockResolvedValue(0);

      await service.getUtmAnalytics({ distributorUuid: DISTRIBUTOR_UUID });

      expect(mockPrisma.lead.count).toHaveBeenCalledWith(
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

    it('returns all-time UTM data with no createdAt filter when no params provided', async () => {
      mockPrisma.lead.count.mockResolvedValue(0);

      await service.getUtmAnalytics({});

      const callArgs = mockPrisma.lead.count.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(callArgs.where).not.toHaveProperty('createdAt');
    });

    it('applies createdAt date filter when from/to params provided', async () => {
      mockPrisma.lead.count.mockResolvedValue(0);

      await service.getUtmAnalytics({ from: '2026-04-01', to: '2026-04-13' });

      const callArgs = mockPrisma.lead.count.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(callArgs.where).toHaveProperty('createdAt');
    });

    it('returns null from/to in response when no params provided', async () => {
      mockPrisma.lead.count.mockResolvedValue(0);

      const result = await service.getUtmAnalytics({});

      expect(result.from).toBeNull();
      expect(result.to).toBeNull();
    });
  });

  // ══════════════════════════════════════════════════════════
  // getDistributorsAnalytics()
  // ══════════════════════════════════════════════════════════
  describe('getDistributorsAnalytics()', () => {
    it('returns zeros when no distributors exist', async () => {
      // Defaults: user.findMany=[] and lead.groupBy=[] for all 4 calls.
      const result = await service.getDistributorsAnalytics({});

      expect(result.lifetime.totalDistributors).toBe(0);
      expect(result.thisMonth.activeDistributors).toBe(0);
      expect(result.lifetime.avgLeadsPerDistributor).toBe(0);
      expect(result.lifetime.avgConversionRate).toBe(0);
      expect(result.lifetime.topDistributors).toHaveLength(0);
    });

    it('calculates distributor stats from leads', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        {
          uuid: DISTRIBUTOR_UUID,
          fullName: 'Rahul',
          distributorCode: 'NSI-RAH01',
        },
      ]);
      // Four lead.groupBy calls in this exact order: totals, converted,
      // active, funnel.
      mockPrisma.lead.groupBy
        .mockResolvedValueOnce([
          { distributorUuid: DISTRIBUTOR_UUID, _count: { uuid: 2 } },
        ])
        .mockResolvedValueOnce([
          { distributorUuid: DISTRIBUTOR_UUID, _count: { uuid: 1 } },
        ])
        .mockResolvedValueOnce([{ distributorUuid: DISTRIBUTOR_UUID }])
        .mockResolvedValueOnce([]);

      const result = await service.getDistributorsAnalytics({});

      expect(result.lifetime.totalDistributors).toBe(1);
      expect(result.thisMonth.activeDistributors).toBe(1);
      expect(result.lifetime.topDistributors[0].totalLeads).toBe(2);
      expect(result.lifetime.topDistributors[0].convertedLeads).toBe(1);
      expect(result.lifetime.topDistributors[0].conversionRate).toBe(50);
    });

    it('includes funnel path from distributor leads', async () => {
      // funnelGroups is the 4th lead.groupBy call.
      mockPrisma.lead.groupBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { status: 'HOT', _count: { uuid: 2 } },
          { status: 'MARK_AS_CUSTOMER', _count: { uuid: 1 } },
        ]);

      const result = await service.getDistributorsAnalytics({});

      expect(
        result.period.funnelPath.some(
          (f: { stage: string; count: number }) =>
            f.stage === 'HOT' && f.count === 2,
        ),
      ).toBe(true);
    });

    it('throws BadRequestException for invalid date range', async () => {
      await expect(
        service.getDistributorsAnalytics({
          from: '2026-06-01',
          to: '2026-01-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('period.from/to reflect applied range, null in all-time mode', async () => {
      const allTime = await service.getDistributorsAnalytics({});
      expect(allTime.period.from).toBeNull();
      expect(allTime.period.to).toBeNull();

      const ranged = await service.getDistributorsAnalytics({
        from: '2026-04-01',
        to: '2026-04-21',
      });
      expect(typeof ranged.period.from).toBe('string');
      expect(typeof ranged.period.to).toBe('string');
    });
  });
});
