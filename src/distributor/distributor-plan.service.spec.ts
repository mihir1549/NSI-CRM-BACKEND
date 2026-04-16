import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DistributorPlanService } from './distributor-plan.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { DistributorSubscriptionHistoryService } from './distributor-subscription-history.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const PLAN_UUID = '11111111-1111-1111-1111-111111111111';
const ACTOR_UUID = '22222222-2222-2222-2222-222222222222';
const USER_UUID = '33333333-3333-3333-3333-333333333333';

const mockPlan = {
  uuid: PLAN_UUID,
  razorpayPlanId: 'mock_plan_abc123',
  name: 'Pro Plan',
  amount: 999,
  interval: 'monthly',
  isActive: true,
  tagline: 'Best value',
  features: ['Feature A', 'Feature B'],
  trustBadges: [],
  ctaText: 'Subscribe Now',
  highlightBadge: null,
  testimonials: '[]',
  createdAt: new Date('2026-01-01'),
};

const createPlanDto = {
  name: 'Pro Plan',
  amount: 999,
  tagline: 'Best value',
  features: ['Feature A'],
  trustBadges: [],
  ctaText: 'Subscribe Now',
  highlightBadge: null,
  testimonials: [],
};

// ─── Mocks ────────────────────────────────────────────────────────────────────
const mockPrisma = {
  distributorPlan: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  distributorSubscription: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
};

const mockAudit = { log: jest.fn() };

const mockMailService = {
  sendSubscriptionMigrationNoticeEmail: jest.fn(),
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

describe('DistributorPlanService', () => {
  let service: DistributorPlanService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DistributorPlanService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AuditService, useValue: mockAudit },
        { provide: MailService, useValue: mockMailService },
        {
          provide: DistributorSubscriptionHistoryService,
          useValue: mockHistoryService,
        },
      ],
    }).compile();

    service = module.get<DistributorPlanService>(DistributorPlanService);
    jest.resetAllMocks();

    mockConfigService.get.mockImplementation(
      (key: string, defaultValue?: string) => {
        const cfg: Record<string, string> = {
          PAYMENT_PROVIDER: 'mock',
          FRONTEND_URL: 'https://growithnsi.com',
        };
        return cfg[key] ?? defaultValue;
      },
    );

    mockPrisma.distributorPlan.findFirst.mockResolvedValue(null);
    mockPrisma.distributorPlan.findUnique.mockResolvedValue(mockPlan);
    mockPrisma.distributorPlan.findMany.mockResolvedValue([mockPlan]);
    mockPrisma.distributorPlan.create.mockResolvedValue(mockPlan);
    mockPrisma.distributorPlan.update.mockResolvedValue({
      ...mockPlan,
      isActive: false,
    });
    mockPrisma.distributorSubscription.findMany.mockResolvedValue([]);
    mockPrisma.distributorSubscription.update.mockResolvedValue({});
    mockHistoryService.log.mockResolvedValue(undefined);
  });

  // ══════════════════════════════════════════════════════════
  // createPlan()
  // ══════════════════════════════════════════════════════════
  describe('createPlan()', () => {
    it('creates plan in mock mode and calls audit', async () => {
      const result = await service.createPlan(
        createPlanDto as any,
        ACTOR_UUID,
        '127.0.0.1',
      );

      expect(mockPrisma.distributorPlan.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Pro Plan',
            amount: 999,
            razorpayPlanId: expect.stringMatching(/^mock_plan_/),
          }),
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DISTRIBUTOR_PLAN_CREATED',
          actorUuid: ACTOR_UUID,
        }),
      );
      expect(result.uuid).toBe(PLAN_UUID);
    });

    it('throws ConflictException when active plan with same amount already exists', async () => {
      mockPrisma.distributorPlan.findFirst
        .mockResolvedValueOnce(mockPlan) // duplicate check
        .mockResolvedValueOnce(null); // active plan check (not reached)

      await expect(
        service.createPlan(createPlanDto as any, ACTOR_UUID, '127.0.0.1'),
      ).rejects.toThrow(ConflictException);
      expect(mockPrisma.distributorPlan.create).not.toHaveBeenCalled();
    });

    it('generates mock razorpayPlanId when PAYMENT_PROVIDER is mock', async () => {
      await service.createPlan(createPlanDto as any, ACTOR_UUID, '127.0.0.1');

      expect(mockPrisma.distributorPlan.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            razorpayPlanId: expect.stringMatching(/^mock_plan_/),
          }),
        }),
      );
    });

    it('serializes testimonials as JSON string', async () => {
      const dtoWithTestimonials = {
        ...createPlanDto,
        testimonials: [{ name: 'John', text: 'Great!' }],
      };

      await service.createPlan(
        dtoWithTestimonials as any,
        ACTOR_UUID,
        '127.0.0.1',
      );

      expect(mockPrisma.distributorPlan.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            testimonials: JSON.stringify(dtoWithTestimonials.testimonials),
          }),
        }),
      );
    });

    it('auto-deactivates existing active plan and triggers migration', async () => {
      const existingActivePlan = {
        ...mockPlan,
        uuid: 'old-plan-uuid',
        amount: 500,
      };
      mockPrisma.distributorPlan.findFirst
        .mockResolvedValueOnce(null) // duplicate check (different amount)
        .mockResolvedValueOnce(existingActivePlan); // active plan check

      const activeSub = {
        uuid: 'sub-1',
        userUuid: USER_UUID,
        razorpaySubscriptionId: 'sub_razorpay_1',
        currentPeriodEnd: new Date('2026-05-01'),
        user: {
          uuid: USER_UUID,
          email: 'test@example.com',
          fullName: 'Test User',
        },
      };
      mockPrisma.distributorSubscription.findMany.mockResolvedValue([
        activeSub,
      ]);

      await service.createPlan(createPlanDto as any, ACTOR_UUID, '127.0.0.1');

      // Old plan should be deactivated
      expect(mockPrisma.distributorPlan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uuid: 'old-plan-uuid' },
          data: { isActive: false },
        }),
      );
      // Migration should be triggered
      expect(mockPrisma.distributorSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ migrationPending: true }),
        }),
      );
      // Email 1 should be sent
      expect(
        mockMailService.sendSubscriptionMigrationNoticeEmail,
      ).toHaveBeenCalledWith(
        'test@example.com',
        expect.objectContaining({ fullName: 'Test User' }),
      );
      // History should be logged
      expect(mockHistoryService.log).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'MIGRATION_INITIATED' }),
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // listPlans()
  // ══════════════════════════════════════════════════════════
  describe('listPlans()', () => {
    it('returns all plans ordered by createdAt desc', async () => {
      const result = await service.listPlans();

      expect(mockPrisma.distributorPlan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
      expect(result).toHaveLength(1);
    });

    it('returns empty array when no plans', async () => {
      mockPrisma.distributorPlan.findMany.mockResolvedValue([]);

      const result = await service.listPlans();

      expect(result).toHaveLength(0);
    });
  });

  // ══════════════════════════════════════════════════════════
  // deactivatePlan()
  // ══════════════════════════════════════════════════════════
  describe('deactivatePlan()', () => {
    it('deactivates plan, triggers migration, and returns affected count', async () => {
      mockPrisma.distributorSubscription.findMany.mockResolvedValue([]);

      const result = await service.deactivatePlan(
        PLAN_UUID,
        ACTOR_UUID,
        '127.0.0.1',
      );

      expect(mockPrisma.distributorPlan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uuid: PLAN_UUID },
          data: { isActive: false },
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DISTRIBUTOR_PLAN_DEACTIVATED' }),
      );
      expect(result.affectedSubscribers).toBe(0);
      expect(result.message).toContain('0 subscribers');
    });

    it('returns count of affected subscribers when migration triggered', async () => {
      const activeSubs = [
        {
          uuid: 'sub-1',
          userUuid: USER_UUID,
          razorpaySubscriptionId: 'sub_1',
          currentPeriodEnd: new Date('2026-05-01'),
          user: {
            uuid: USER_UUID,
            email: 'test@example.com',
            fullName: 'Test',
          },
        },
      ];
      mockPrisma.distributorSubscription.findMany.mockResolvedValue(activeSubs);

      const result = await service.deactivatePlan(
        PLAN_UUID,
        ACTOR_UUID,
        '127.0.0.1',
      );

      expect(result.affectedSubscribers).toBe(1);
      expect(result.message).toContain('1 subscribers');
    });

    it('throws NotFoundException when plan not found', async () => {
      mockPrisma.distributorPlan.findUnique.mockResolvedValue(null);

      await expect(
        service.deactivatePlan(PLAN_UUID, ACTOR_UUID, '127.0.0.1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // updatePlan()
  // ══════════════════════════════════════════════════════════
  describe('updatePlan()', () => {
    it('updates plan name and tagline', async () => {
      const updated = {
        ...mockPlan,
        name: 'Updated Plan',
        tagline: 'New tagline',
      };
      mockPrisma.distributorPlan.update.mockResolvedValue(updated);

      const result = await service.updatePlan(PLAN_UUID, {
        name: 'Updated Plan',
        tagline: 'New tagline',
      } as any);

      expect(mockPrisma.distributorPlan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uuid: PLAN_UUID },
          data: expect.objectContaining({
            name: 'Updated Plan',
            tagline: 'New tagline',
          }),
        }),
      );
      expect(result.name).toBe('Updated Plan');
    });

    it('serializes testimonials to JSON when provided', async () => {
      const dto = { testimonials: [{ name: 'Jane', text: 'Excellent!' }] };
      mockPrisma.distributorPlan.update.mockResolvedValue(mockPlan);

      await service.updatePlan(PLAN_UUID, dto as any);

      expect(mockPrisma.distributorPlan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            testimonials: JSON.stringify(dto.testimonials),
          }),
        }),
      );
    });

    it('throws NotFoundException when plan not found', async () => {
      mockPrisma.distributorPlan.findUnique.mockResolvedValue(null);

      await expect(service.updatePlan(PLAN_UUID, {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // getActivePlans()
  // ══════════════════════════════════════════════════════════
  describe('getActivePlans()', () => {
    it('returns active plans with parsed testimonials', async () => {
      const planWithTestimonials = {
        ...mockPlan,
        testimonials: JSON.stringify([{ name: 'John', text: 'Great!' }]),
      };
      mockPrisma.distributorPlan.findMany.mockResolvedValue([
        planWithTestimonials,
      ]);

      const result = await service.getActivePlans();

      expect(result[0].testimonials).toEqual([
        { name: 'John', text: 'Great!' },
      ]);
    });

    it('returns empty testimonials array for malformed JSON', async () => {
      const planWithBadJson = { ...mockPlan, testimonials: '{invalid json}' };
      mockPrisma.distributorPlan.findMany.mockResolvedValue([planWithBadJson]);

      const result = await service.getActivePlans();

      expect(result[0].testimonials).toEqual([]);
    });

    it('filters to only active plans', async () => {
      await service.getActivePlans();

      expect(mockPrisma.distributorPlan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });
  });
});
