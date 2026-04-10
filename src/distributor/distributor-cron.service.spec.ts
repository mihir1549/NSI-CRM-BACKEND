import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DistributorCronService } from './distributor-cron.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { DistributorSubscriptionHistoryService } from './distributor-subscription-history.service';

// ─── Fixtures ────────────────────────────────────────────────────────────────
const USER_UUID   = '11111111-1111-1111-1111-111111111111';
const ADMIN_UUID  = '55555555-5555-5555-5555-555555555555';
const SUB_UUID    = '33333333-3333-3333-3333-333333333333';

const mockSuperAdmin = {
  uuid: ADMIN_UUID,
  role: 'SUPER_ADMIN',
  createdAt: new Date('2025-01-01'),
};

const mockUser = {
  uuid: USER_UUID,
  fullName: 'Rahul Sharma',
  email: 'rahul@example.com',
  role: 'DISTRIBUTOR',
};

// A subscription past its graceDeadline (expired)
const expiredSub = {
  uuid: SUB_UUID,
  userUuid: USER_UUID,
  razorpaySubscriptionId: 'sub_mock123',
  status: 'HALTED',
  graceDeadline: new Date('2026-04-01'), // in the past
  user: mockUser,
};

// A subscription whose grace deadline is exactly 3 days from now (reminder)
const graceSub = {
  uuid: '66666666-6666-6666-6666-666666666666',
  userUuid: USER_UUID,
  razorpaySubscriptionId: 'sub_grace123',
  status: 'HALTED',
  graceDeadline: (() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d;
  })(),
  user: mockUser,
};

// ─── Mock dependencies ────────────────────────────────────────────────────────
const mockPrisma = {
  distributorSubscription: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  lead: {
    updateMany: jest.fn(),
  },
};

const mockAuditService = { log: jest.fn() };

const mockMailService = {
  sendSubscriptionExpiredEmail: jest.fn(),
  sendSubscriptionGraceReminderEmail: jest.fn(),
};

const mockHistoryService = { log: jest.fn() };

const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: string) => {
    const cfg: Record<string, string> = {
      PAYMENT_PROVIDER: 'mock',
      FRONTEND_URL: 'https://growithnsi.com',
    };
    return cfg[key] ?? defaultValue;
  }),
};

describe('DistributorCronService', () => {
  let service: DistributorCronService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DistributorCronService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAuditService },
        { provide: MailService, useValue: mockMailService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: DistributorSubscriptionHistoryService, useValue: mockHistoryService },
      ],
    }).compile();

    service = module.get<DistributorCronService>(DistributorCronService);
    jest.clearAllMocks();

    mockConfigService.get.mockImplementation((key: string, defaultValue?: string) => {
      const cfg: Record<string, string> = {
        PAYMENT_PROVIDER: 'mock',
        FRONTEND_URL: 'https://growithnsi.com',
      };
      return cfg[key] ?? defaultValue;
    });
    mockHistoryService.log.mockResolvedValue(undefined);
    mockPrisma.lead.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.distributorSubscription.update.mockResolvedValue({});
    mockPrisma.user.update.mockResolvedValue({});
  });

  // ══════════════════════════════════════════════════════════
  // handleExpiry — expired subscriptions section
  // ══════════════════════════════════════════════════════════
  describe('processExpiredSubscriptions() — expiry section', () => {
    it('does nothing when no expired subscriptions found', async () => {
      mockPrisma.distributorSubscription.findMany
        .mockResolvedValueOnce([]) // expired query
        .mockResolvedValueOnce([]); // grace query

      await service.processExpiredSubscriptions();

      expect(mockPrisma.distributorSubscription.update).not.toHaveBeenCalled();
      expect(mockMailService.sendSubscriptionExpiredEmail).not.toHaveBeenCalled();
    });

    it('sets subscription status to EXPIRED for each expired sub', async () => {
      mockPrisma.distributorSubscription.findMany
        .mockResolvedValueOnce([expiredSub])
        .mockResolvedValueOnce([]);
      mockPrisma.user.findFirst.mockResolvedValue(mockSuperAdmin);

      await service.processExpiredSubscriptions();

      expect(mockPrisma.distributorSubscription.update).toHaveBeenCalledWith({
        where: { uuid: SUB_UUID },
        data: { status: 'EXPIRED' },
      });
    });

    it('downgrades user role to CUSTOMER and deactivates join link', async () => {
      mockPrisma.distributorSubscription.findMany
        .mockResolvedValueOnce([expiredSub])
        .mockResolvedValueOnce([]);
      mockPrisma.user.findFirst.mockResolvedValue(mockSuperAdmin);

      await service.processExpiredSubscriptions();

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { uuid: USER_UUID },
        data: { role: 'CUSTOMER', joinLinkActive: false },
      });
    });

    it('reassigns HOT leads to Super Admin', async () => {
      mockPrisma.distributorSubscription.findMany
        .mockResolvedValueOnce([expiredSub])
        .mockResolvedValueOnce([]);
      mockPrisma.user.findFirst.mockResolvedValue(mockSuperAdmin);

      await service.processExpiredSubscriptions();

      expect(mockPrisma.lead.updateMany).toHaveBeenCalledWith({
        where: { distributorUuid: USER_UUID, status: 'HOT' },
        data: { assignedToUuid: ADMIN_UUID },
      });
    });

    it('logs EXPIRED event to history for each expired sub', async () => {
      mockPrisma.distributorSubscription.findMany
        .mockResolvedValueOnce([expiredSub])
        .mockResolvedValueOnce([]);
      mockPrisma.user.findFirst.mockResolvedValue(mockSuperAdmin);

      await service.processExpiredSubscriptions();

      expect(mockHistoryService.log).toHaveBeenCalledWith(
        expect.objectContaining({ userUuid: USER_UUID, event: 'EXPIRED' }),
      );
    });

    it('sends expired email for each expired sub (fire and forget)', async () => {
      mockPrisma.distributorSubscription.findMany
        .mockResolvedValueOnce([expiredSub])
        .mockResolvedValueOnce([]);
      mockPrisma.user.findFirst.mockResolvedValue(mockSuperAdmin);

      await service.processExpiredSubscriptions();

      expect(mockMailService.sendSubscriptionExpiredEmail).toHaveBeenCalledWith(
        mockUser.email,
        expect.objectContaining({ fullName: mockUser.fullName }),
      );
    });

    it('skips expired processing if Super Admin not found', async () => {
      mockPrisma.distributorSubscription.findMany
        .mockResolvedValueOnce([expiredSub])
        .mockResolvedValueOnce([]);
      mockPrisma.user.findFirst.mockResolvedValue(null); // no super admin

      await service.processExpiredSubscriptions();

      expect(mockPrisma.distributorSubscription.update).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════
  // handleGraceReminder — 3-day reminder section
  // ══════════════════════════════════════════════════════════
  describe('processExpiredSubscriptions() — grace reminder section', () => {
    it('sends grace reminder email for subscriptions expiring in 3 days', async () => {
      mockPrisma.distributorSubscription.findMany
        .mockResolvedValueOnce([]) // no expired subs
        .mockResolvedValueOnce([graceSub]); // grace reminder sub

      await service.processExpiredSubscriptions();

      expect(mockMailService.sendSubscriptionGraceReminderEmail).toHaveBeenCalledWith(
        mockUser.email,
        expect.objectContaining({
          fullName: mockUser.fullName,
          paymentMethodUrl: 'https://mock-razorpay.com/update-payment',
        }),
      );
    });

    it('does nothing if no grace reminder subscriptions found', async () => {
      mockPrisma.distributorSubscription.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.processExpiredSubscriptions();

      expect(mockMailService.sendSubscriptionGraceReminderEmail).not.toHaveBeenCalled();
    });
  });
});
