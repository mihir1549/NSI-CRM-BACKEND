import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DistributorService } from './distributor.service';
import { PrismaService } from '../prisma/prisma.service';
import { LeadStatus } from '@prisma/client';

// ─── Mock QRCode ──────────────────────────────────────────────────────────────
jest.mock('qrcode', () => ({
  __esModule: true,
  default: {
    toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,mockQR'),
  },
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const DISTRIBUTOR_UUID = '11111111-1111-1111-1111-111111111111';
const TARGET_USER_UUID = '22222222-2222-2222-2222-222222222222';
const LEAD_UUID        = '33333333-3333-3333-3333-333333333333';
const ENROLLMENT_UUID  = '44444444-4444-4444-4444-444444444444';

const mockDistributorUser = {
  uuid: DISTRIBUTOR_UUID,
  fullName: 'Rahul Distributor',
  email: 'rahul@nsi.com',
  distributorCode: 'NSI-RAH01',
  joinLinkActive: true,
  role: 'DISTRIBUTOR',
  status: 'ACTIVE',
  country: 'IN',
  avatarUrl: null,
  createdAt: new Date('2026-01-01'),
};

const mockTargetUser = {
  uuid: TARGET_USER_UUID,
  fullName: 'Target User',
  email: 'target@test.com',
  role: 'USER',
  status: 'ACTIVE',
  country: 'IN',
  avatarUrl: null,
  createdAt: new Date('2026-02-01'),
  profile: { phone: '+919999999999' },
};

const mockLead = {
  uuid: LEAD_UUID,
  userUuid: TARGET_USER_UUID,
  distributorUuid: DISTRIBUTOR_UUID,
  assignedToUuid: DISTRIBUTOR_UUID,
  status: LeadStatus.HOT,
  activities: [],
  nurtureEnrollment: null,
};

// ─── Prisma mock ──────────────────────────────────────────────────────────────
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  lead: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
  },
  distributorSubscription: {
    findUnique: jest.fn(),
  },
  userAcquisition: {
    findMany: jest.fn(),
  },
  payment: {
    groupBy: jest.fn(),
    findMany: jest.fn(),
  },
  funnelProgress: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  funnelStep: {
    count: jest.fn(),
  },
  courseEnrollment: {
    findMany: jest.fn(),
  },
  lessonProgress: {
    findMany: jest.fn(),
  },
};

const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: string) => {
    const cfg: Record<string, string> = {
      FRONTEND_URL: 'https://growithnsi.com',
    };
    return cfg[key] ?? defaultValue;
  }),
};

describe('DistributorService', () => {
  let service: DistributorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DistributorService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<DistributorService>(DistributorService);
    jest.clearAllMocks();

    // Safe defaults
    mockPrisma.user.findUnique.mockResolvedValue(mockDistributorUser);
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);
    mockPrisma.lead.findMany.mockResolvedValue([]);
    mockPrisma.lead.findFirst.mockResolvedValue(mockLead);
    mockPrisma.lead.count.mockResolvedValue(0);
    mockPrisma.distributorSubscription.findUnique.mockResolvedValue(null);
    mockPrisma.userAcquisition.findMany.mockResolvedValue([]);
    mockPrisma.payment.groupBy.mockResolvedValue([]);
    mockPrisma.payment.findMany.mockResolvedValue([]);
    mockPrisma.funnelProgress.findMany.mockResolvedValue([]);
    mockPrisma.funnelProgress.findUnique.mockResolvedValue(null);
    mockPrisma.funnelStep.count.mockResolvedValue(10);
    mockPrisma.courseEnrollment.findMany.mockResolvedValue([]);
    mockPrisma.lessonProgress.findMany.mockResolvedValue([]);
    mockConfigService.get.mockImplementation((key: string, defaultValue?: string) => {
      const cfg: Record<string, string> = { FRONTEND_URL: 'https://growithnsi.com' };
      return cfg[key] ?? defaultValue;
    });
  });

  // ══════════════════════════════════════════════════════════
  // getJoinLink()
  // ══════════════════════════════════════════════════════════
  describe('getJoinLink()', () => {
    it('returns join link with QR code for distributor', async () => {
      const result = await service.getJoinLink(DISTRIBUTOR_UUID);

      expect(result.code).toBe('NSI-RAH01');
      expect(result.url).toBe('https://growithnsi.com/join/NSI-RAH01');
      expect(result.qrCode).toBe('data:image/png;base64,mockQR');
      expect(result.isActive).toBe(true);
    });

    it('throws NotFoundException when user has no distributor code', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockDistributorUser, distributorCode: null });

      await expect(service.getJoinLink(DISTRIBUTOR_UUID)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getJoinLink(DISTRIBUTOR_UUID)).rejects.toThrow(NotFoundException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // getDashboard()
  // ══════════════════════════════════════════════════════════
  describe('getDashboard()', () => {
    it('returns dashboard with lead counts and subscription info', async () => {
      mockPrisma.lead.count
        .mockResolvedValueOnce(10)  // totalLeads
        .mockResolvedValueOnce(3)   // hotLeads
        .mockResolvedValueOnce(2)   // contactedLeads
        .mockResolvedValueOnce(1);  // customers

      const result = await service.getDashboard(DISTRIBUTOR_UUID);

      expect(result.totalLeads).toBe(10);
      expect(result.hotLeads).toBe(3);
      expect(result.customers).toBe(1);
      expect(result.conversionRate).toBe('10.00%');
      expect(result.subscription).toBeNull();
      expect(result.joinLink?.url).toContain('NSI-RAH01');
    });

    it('includes subscription when active', async () => {
      mockPrisma.lead.count.mockResolvedValue(0);
      mockPrisma.distributorSubscription.findUnique.mockResolvedValue({
        status: 'ACTIVE',
        currentPeriodEnd: new Date('2026-06-01'),
        graceDeadline: null,
        plan: { name: 'Pro Plan', amount: 999 },
      });

      const result = await service.getDashboard(DISTRIBUTOR_UUID);

      expect(result.subscription?.status).toBe('ACTIVE');
      expect(result.subscription?.plan.name).toBe('Pro Plan');
    });

    it('returns 0% conversion when no leads', async () => {
      mockPrisma.lead.count.mockResolvedValue(0);

      const result = await service.getDashboard(DISTRIBUTOR_UUID);

      expect(result.conversionRate).toBe('0.00%');
    });
  });

  // ══════════════════════════════════════════════════════════
  // getUtmAnalytics()
  // ══════════════════════════════════════════════════════════
  describe('getUtmAnalytics()', () => {
    it('returns empty analytics when no leads in date range', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([]);

      const result = await service.getUtmAnalytics(DISTRIBUTOR_UUID, {});

      expect(result.bySource).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.from).toBeDefined();
      expect(result.to).toBeDefined();
    });

    it('returns UTM breakdown when leads exist', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([{ userUuid: TARGET_USER_UUID }]);
      mockPrisma.userAcquisition.findMany.mockResolvedValue([
        { utmSource: 'facebook', utmMedium: 'social', utmCampaign: 'summer' },
        { utmSource: 'google', utmMedium: 'cpc', utmCampaign: null },
      ]);

      const result = await service.getUtmAnalytics(DISTRIBUTOR_UUID, {});

      expect(result.total).toBe(1);
      expect(result.bySource.some((s) => s.source === 'facebook')).toBe(true);
      expect(result.byMedium.some((m) => m.medium === 'social')).toBe(true);
      expect(result.byCampaign.some((c) => c.campaign === 'direct')).toBe(true); // null → 'direct'
    });

    it('supports custom date range', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([]);
      const query = { from: '2026-01-01', to: '2026-03-31' };

      const result = await service.getUtmAnalytics(DISTRIBUTOR_UUID, query);

      expect(new Date(result.from).getFullYear()).toBe(2026);
      expect(new Date(result.to).getMonth()).toBe(2); // March = index 2
    });
  });

  // ══════════════════════════════════════════════════════════
  // getUsersAnalytics()
  // ══════════════════════════════════════════════════════════
  describe('getUsersAnalytics()', () => {
    it('returns zero analytics when no referred users', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([]);

      const result = await service.getUsersAnalytics(DISTRIBUTOR_UUID);

      expect(result.totalUsers).toBe(0);
      expect(result.conversionRate).toBe('0.00%');
    });

    it('calculates user analytics correctly', async () => {
      const leads = [
        { userUuid: TARGET_USER_UUID, status: LeadStatus.HOT },
        { userUuid: 'user-2-uuid', status: LeadStatus.MARK_AS_CUSTOMER },
      ];
      mockPrisma.lead.findMany.mockResolvedValue(leads);
      mockPrisma.payment.groupBy.mockResolvedValue([{ userUuid: TARGET_USER_UUID }]); // 1 paid
      mockPrisma.funnelProgress.findMany.mockResolvedValue([
        { phoneVerified: true, paymentCompleted: true, decisionAnswer: 'YES' },
      ]);

      const result = await service.getUsersAnalytics(DISTRIBUTOR_UUID);

      expect(result.totalUsers).toBe(2);
      expect(result.hotLeads).toBe(1);
      expect(result.customers).toBe(1);
      expect(result.paidUsers).toBe(1);
      expect(result.conversionRate).toBe('50.00%');
      expect(result.funnelDropOff.saidYes).toBe(1);
    });
  });

  // ══════════════════════════════════════════════════════════
  // listUsers()
  // ══════════════════════════════════════════════════════════
  describe('listUsers()', () => {
    it('returns paginated users for distributor', async () => {
      const userWithFunnel = {
        ...mockTargetUser,
        leadAsUser: { status: LeadStatus.HOT },
        profile: { phone: '+919999999999' },
        funnelProgress: {
          phoneVerified: true,
          paymentCompleted: false,
          decisionAnswer: null,
          stepProgress: [],
        },
        payments: [],
      };
      mockPrisma.user.findMany.mockResolvedValue([userWithFunnel]);
      mockPrisma.user.count.mockResolvedValue(1);

      const result = await service.listUsers(DISTRIBUTOR_UUID, { page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.items[0].funnelStage).toBe('PHONE_VERIFIED');
    });

    it('returns empty result when no users', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      const result = await service.listUsers(DISTRIBUTOR_UUID, {});

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('computes SAID_YES funnel stage correctly', async () => {
      const userWithYes = {
        ...mockTargetUser,
        leadAsUser: { status: LeadStatus.HOT },
        profile: null,
        funnelProgress: {
          phoneVerified: true,
          paymentCompleted: true,
          decisionAnswer: 'YES',
          stepProgress: [],
        },
        payments: [{ uuid: 'pay-1' }],
      };
      mockPrisma.user.findMany.mockResolvedValue([userWithYes]);
      mockPrisma.user.count.mockResolvedValue(1);

      const result = await service.listUsers(DISTRIBUTOR_UUID, {});

      expect(result.items[0].funnelStage).toBe('SAID_YES');
      expect(result.items[0].paymentStatus).toBe('Paid');
    });
  });

  // ══════════════════════════════════════════════════════════
  // getUserDetail()
  // ══════════════════════════════════════════════════════════
  describe('getUserDetail()', () => {
    it('returns full user detail for authorized distributor', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue(mockLead);
      mockPrisma.user.findUnique.mockResolvedValue(mockTargetUser);
      mockPrisma.funnelProgress.findUnique.mockResolvedValue(null);
      mockPrisma.courseEnrollment.findMany.mockResolvedValue([]);

      const result = await service.getUserDetail(DISTRIBUTOR_UUID, TARGET_USER_UUID);

      expect(result.uuid).toBe(TARGET_USER_UUID);
      expect(result.lead.uuid).toBe(LEAD_UUID);
      expect(result.funnelProgress).toBeNull();
      expect(result.lmsProgress).toHaveLength(0);
    });

    it('throws NotFoundException when lead does not belong to distributor', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue(null);

      await expect(service.getUserDetail(DISTRIBUTOR_UUID, TARGET_USER_UUID)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when user record not found', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue(mockLead);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.funnelProgress.findUnique.mockResolvedValue(null);
      mockPrisma.courseEnrollment.findMany.mockResolvedValue([]);

      await expect(service.getUserDetail(DISTRIBUTOR_UUID, TARGET_USER_UUID)).rejects.toThrow(NotFoundException);
    });

    it('includes nurture enrollment when present', async () => {
      const leadWithNurture = {
        ...mockLead,
        nurtureEnrollment: {
          day1SentAt: new Date(),
          day3SentAt: null,
          day7SentAt: null,
          status: 'ACTIVE',
          updatedAt: new Date(),
        },
      };
      mockPrisma.lead.findFirst.mockResolvedValue(leadWithNurture);
      mockPrisma.user.findUnique.mockResolvedValue(mockTargetUser);
      mockPrisma.funnelProgress.findUnique.mockResolvedValue(null);
      mockPrisma.courseEnrollment.findMany.mockResolvedValue([]);

      const result = await service.getUserDetail(DISTRIBUTOR_UUID, TARGET_USER_UUID);

      expect(result.lead.nurtureEnrollment?.currentDay).toBe(1);
    });

    it('includes funnel progress when available', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue(mockLead);
      mockPrisma.user.findUnique.mockResolvedValue(mockTargetUser);
      mockPrisma.funnelProgress.findUnique.mockResolvedValue({
        uuid: 'fp-uuid',
        phoneVerified: true,
        paymentCompleted: false,
        decisionAnswer: null,
        decisionAnsweredAt: null,
        stepProgress: [],
      });
      mockPrisma.courseEnrollment.findMany.mockResolvedValue([]);

      const result = await service.getUserDetail(DISTRIBUTOR_UUID, TARGET_USER_UUID);

      expect(result.funnelProgress?.phoneVerified).toBe(true);
      expect(result.funnelProgress?.totalSteps).toBe(10);
    });
  });

  // ══════════════════════════════════════════════════════════
  // resolveJoinCode()
  // ══════════════════════════════════════════════════════════
  describe('resolveJoinCode()', () => {
    it('resolves an active join code', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockDistributorUser);

      const result = await service.resolveJoinCode('NSI-RAH01');

      expect(result.distributorUuid).toBe(DISTRIBUTOR_UUID);
      expect(result.code).toBe('NSI-RAH01');
      expect(result.isActive).toBe(true);
    });

    it('throws NotFoundException when code does not exist', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(service.resolveJoinCode('INVALID-CODE')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when join link is inactive', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ ...mockDistributorUser, joinLinkActive: false });

      await expect(service.resolveJoinCode('NSI-RAH01')).rejects.toThrow(NotFoundException);
    });
  });
});
