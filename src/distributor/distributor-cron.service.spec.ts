import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DistributorCronService } from './distributor-cron.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { DistributorSubscriptionHistoryService } from './distributor-subscription-history.service';

// ─── Fixtures ────────────────────────────────────────────────────────────────
const USER_UUID = '11111111-1111-1111-1111-111111111111';
const ADMIN_UUID = '55555555-5555-5555-5555-555555555555';
const SUB_UUID = '33333333-3333-3333-3333-333333333333';

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
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
  userAcquisition: {
    updateMany: jest.fn(),
  },
};

const mockAuditService = { log: jest.fn() };

const mockMailService = {
  sendSubscriptionExpiredEmail: jest.fn(),
  sendSubscriptionGraceReminderEmail: jest.fn(),
  sendSubscriptionMigrationReminderEmail: jest.fn(),
  sendSubscriptionMigrationEndedEmail: jest.fn(),
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

/**
 * Helper: set up findMany to return the given arrays in order.
 * The cron method calls findMany 5 times:
 *   1. expired subs
 *   2. grace reminder subs
 *   3. migration reminder subs (CHECK A)
 *   4. migration execution subs (CHECK B)
 *   5. halted migration overlap subs (CHECK C)
 */
function setupFindMany(
  expired: any[] = [],
  grace: any[] = [],
  migrationReminder: any[] = [],
  migrationExecution: any[] = [],
  migrationHalted: any[] = [],
) {
  mockPrisma.distributorSubscription.findMany
    .mockResolvedValueOnce(expired)
    .mockResolvedValueOnce(grace)
    .mockResolvedValueOnce(migrationReminder)
    .mockResolvedValueOnce(migrationExecution)
    .mockResolvedValueOnce(migrationHalted);
}

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
        {
          provide: DistributorSubscriptionHistoryService,
          useValue: mockHistoryService,
        },
      ],
    }).compile();

    service = module.get<DistributorCronService>(DistributorCronService);
    jest.clearAllMocks();

    mockConfigService.get.mockImplementation(
      (key: string, defaultValue?: string) => {
        const cfg: Record<string, string> = {
          PAYMENT_PROVIDER: 'mock',
          FRONTEND_URL: 'https://growithnsi.com',
        };
        return cfg[key] ?? defaultValue;
      },
    );
    mockHistoryService.log.mockResolvedValue(undefined);
    mockPrisma.lead.findMany.mockResolvedValue([]);
    mockPrisma.lead.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.userAcquisition.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.distributorSubscription.update.mockResolvedValue({});
    mockPrisma.user.update.mockResolvedValue({});
  });

  // ══════════════════════════════════════════════════════════
  // handleExpiry — expired subscriptions section
  // ══════════════════════════════════════════════════════════
  describe('processExpiredSubscriptions() — expiry section', () => {
    it('does nothing when no expired subscriptions found', async () => {
      setupFindMany();

      await service.processExpiredSubscriptions();

      expect(mockPrisma.distributorSubscription.update).not.toHaveBeenCalled();
      expect(
        mockMailService.sendSubscriptionExpiredEmail,
      ).not.toHaveBeenCalled();
    });

    it('sets subscription status to EXPIRED for each expired sub', async () => {
      setupFindMany([expiredSub]);
      mockPrisma.user.findFirst.mockResolvedValue(mockSuperAdmin);

      await service.processExpiredSubscriptions();

      expect(mockPrisma.distributorSubscription.update).toHaveBeenCalledWith({
        where: { uuid: SUB_UUID },
        data: { status: 'EXPIRED' },
      });
    });

    it('downgrades user role to CUSTOMER and deactivates join link', async () => {
      setupFindMany([expiredSub]);
      mockPrisma.user.findFirst.mockResolvedValue(mockSuperAdmin);

      await service.processExpiredSubscriptions();

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { uuid: USER_UUID },
        data: { role: 'CUSTOMER', joinLinkActive: false },
      });
    });

    it('reassigns all non-terminal leads to Super Admin', async () => {
      setupFindMany([expiredSub]);
      mockPrisma.user.findFirst.mockResolvedValue(mockSuperAdmin);

      await service.processExpiredSubscriptions();

      expect(mockPrisma.lead.updateMany).toHaveBeenCalledWith({
        where: {
          distributorUuid: USER_UUID,
          status: { in: ['NEW', 'WARM', 'HOT', 'CONTACTED', 'FOLLOWUP', 'NURTURE'] },
        },
        data: { assignedToUuid: ADMIN_UUID },
      });
    });

    it('logs EXPIRED event to history for each expired sub', async () => {
      setupFindMany([expiredSub]);
      mockPrisma.user.findFirst.mockResolvedValue(mockSuperAdmin);

      await service.processExpiredSubscriptions();

      expect(mockHistoryService.log).toHaveBeenCalledWith(
        expect.objectContaining({ userUuid: USER_UUID, event: 'EXPIRED' }),
      );
    });

    it('sends expired email for each expired sub (fire and forget)', async () => {
      setupFindMany([expiredSub]);
      mockPrisma.user.findFirst.mockResolvedValue(mockSuperAdmin);

      await service.processExpiredSubscriptions();

      expect(mockMailService.sendSubscriptionExpiredEmail).toHaveBeenCalledWith(
        mockUser.email,
        expect.objectContaining({ fullName: mockUser.fullName }),
      );
    });

    it('skips expired processing if Super Admin not found', async () => {
      setupFindMany([expiredSub]);
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
      setupFindMany([], [graceSub]);

      await service.processExpiredSubscriptions();

      expect(
        mockMailService.sendSubscriptionGraceReminderEmail,
      ).toHaveBeenCalledWith(
        mockUser.email,
        expect.objectContaining({
          fullName: mockUser.fullName,
          paymentMethodUrl: 'https://mock-razorpay.com/update-payment',
        }),
      );
    });

    it('does nothing if no grace reminder subscriptions found', async () => {
      setupFindMany();

      await service.processExpiredSubscriptions();

      expect(
        mockMailService.sendSubscriptionGraceReminderEmail,
      ).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════
  // CHECK A — Migration reminder
  // ══════════════════════════════════════════════════════════
  describe('processExpiredSubscriptions() — migration reminder (CHECK A)', () => {
    it('sends migration reminder email for subs with currentPeriodEnd in 3 days', async () => {
      const migrationSub = {
        uuid: '77777777-7777-7777-7777-777777777777',
        userUuid: USER_UUID,
        currentPeriodEnd: (() => {
          const d = new Date();
          d.setDate(d.getDate() + 3);
          return d;
        })(),
        user: mockUser,
      };
      setupFindMany([], [], [migrationSub]);

      await service.processExpiredSubscriptions();

      expect(
        mockMailService.sendSubscriptionMigrationReminderEmail,
      ).toHaveBeenCalledWith(
        mockUser.email,
        expect.objectContaining({ fullName: mockUser.fullName }),
      );
    });

    it('does nothing if no migration reminder subs found', async () => {
      setupFindMany();

      await service.processExpiredSubscriptions();

      expect(
        mockMailService.sendSubscriptionMigrationReminderEmail,
      ).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════
  // CHECK B — Migration execution
  // ══════════════════════════════════════════════════════════
  describe('processExpiredSubscriptions() — migration execution (CHECK B)', () => {
    it('cancels subscription and sets grace period for migration-due subs', async () => {
      const migrationDueSub = {
        uuid: '88888888-8888-8888-8888-888888888888',
        userUuid: USER_UUID,
        razorpaySubscriptionId: 'sub_migration_1',
        currentPeriodEnd: new Date('2026-04-01'), // in the past
        user: mockUser,
      };
      setupFindMany([], [], [], [migrationDueSub]);

      await service.processExpiredSubscriptions();

      expect(mockPrisma.distributorSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uuid: '88888888-8888-8888-8888-888888888888' },
          data: expect.objectContaining({
            status: 'CANCELLED',
            migrationPending: false,
            graceDeadline: expect.any(Date),
          }),
        }),
      );
      expect(mockHistoryService.log).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'MIGRATION_CANCELLED' }),
      );
      expect(
        mockMailService.sendSubscriptionMigrationEndedEmail,
      ).toHaveBeenCalledWith(
        mockUser.email,
        expect.objectContaining({ fullName: mockUser.fullName }),
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // CHECK C — HALTED + migration overlap
  // ══════════════════════════════════════════════════════════
  describe('processExpiredSubscriptions() — HALTED migration overlap (CHECK C)', () => {
    it('clears migrationPending and logs history for HALTED subs without sending email', async () => {
      const haltedMigrationSub = {
        uuid: '99999999-9999-9999-9999-999999999999',
        userUuid: USER_UUID,
        currentPeriodEnd: new Date('2026-04-01'),
      };
      setupFindMany([], [], [], [], [haltedMigrationSub]);

      await service.processExpiredSubscriptions();

      expect(mockPrisma.distributorSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uuid: '99999999-9999-9999-9999-999999999999' },
          data: { migrationPending: false },
        }),
      );
      expect(mockHistoryService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'MIGRATION_CANCELLED',
          notes: 'Plan billing date reached — subscription was already HALTED',
        }),
      );
      // No email for HALTED overlap
      expect(
        mockMailService.sendSubscriptionMigrationEndedEmail,
      ).not.toHaveBeenCalled();
    });
  });
});
