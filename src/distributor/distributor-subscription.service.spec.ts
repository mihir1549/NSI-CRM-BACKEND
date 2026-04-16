import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DistributorSubscriptionService } from './distributor-subscription.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { InvoiceService } from '../common/invoice/invoice.service';
import { InvoicePdfService } from '../common/invoice/invoice-pdf.service';
import { DistributorSubscriptionHistoryService } from './distributor-subscription-history.service';

// ─── Mock helper to avoid needing DB ────────────────────────────────────────
jest.mock('./distributor-code.helper', () => ({
  generateDistributorCode: jest.fn().mockResolvedValue('NSI-MOCK01'),
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────
const USER_UUID = '11111111-1111-1111-1111-111111111111';
const PLAN_UUID = '22222222-2222-2222-2222-222222222222';
const SUB_UUID = '33333333-3333-3333-3333-333333333333';
const PAYMENT_UUID = '44444444-4444-4444-4444-444444444444';
const ADMIN_UUID = '55555555-5555-5555-5555-555555555555';
const RAZORPAY_SUB = 'sub_mock123';

const mockUser = {
  uuid: USER_UUID,
  fullName: 'Rahul Sharma',
  email: 'rahul@example.com',
  role: 'DISTRIBUTOR',
  distributorCode: 'NSI-TEST01',
};

const mockPlan = {
  uuid: PLAN_UUID,
  name: 'Pro Plan',
  amount: 999,
  isActive: true,
  razorpayPlanId: 'plan_rzp_123',
};

const mockSub = {
  uuid: SUB_UUID,
  userUuid: USER_UUID,
  planUuid: PLAN_UUID,
  razorpaySubscriptionId: RAZORPAY_SUB,
  status: 'ACTIVE',
  currentPeriodEnd: new Date('2026-05-09'),
  graceDeadline: null,
  cancelledAt: null,
  plan: { name: 'Pro Plan' },
};

// ─── Mock dependencies ────────────────────────────────────────────────────────
const mockPrisma = {
  distributorSubscription: {
    findUnique: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  },
  distributorPlan: {
    findUnique: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  lead: {
    updateMany: jest.fn(),
  },
  payment: {
    create: jest.fn(),
    update: jest.fn(),
  },
};

const mockAuditService = { log: jest.fn() };

const mockMailService = {
  sendSubscriptionCancelledByAdminEmail: jest.fn(),
  sendSubscriptionSelfCancelledEmail: jest.fn(),
  sendSubscriptionInvoiceEmail: jest.fn(),
  sendSubscriptionWarningEmail: jest.fn(),
  sendSubscriptionActiveEmail: jest.fn(),
  sendSubscriptionReactivatedEmail: jest.fn(),
};

const mockInvoiceService = {
  generateInvoiceNumber: jest.fn().mockResolvedValue('INV-2026-000001'),
};

const mockInvoicePdfService = {
  generateAndUpload: jest.fn().mockResolvedValue('https://r2.dev/test.pdf'),
};

const mockHistoryService = {
  log: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: string) => {
    const cfg: Record<string, string> = {
      PAYMENT_PROVIDER: 'mock',
      FRONTEND_URL: 'https://growithnsi.com',
    };
    return cfg[key] ?? defaultValue;
  }),
};

describe('DistributorSubscriptionService', () => {
  let service: DistributorSubscriptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DistributorSubscriptionService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: MailService, useValue: mockMailService },
        { provide: InvoiceService, useValue: mockInvoiceService },
        { provide: InvoicePdfService, useValue: mockInvoicePdfService },
        {
          provide: DistributorSubscriptionHistoryService,
          useValue: mockHistoryService,
        },
      ],
    }).compile();

    service = module.get<DistributorSubscriptionService>(
      DistributorSubscriptionService,
    );
    jest.clearAllMocks();

    // Re-apply defaults after clearAllMocks
    mockConfigService.get.mockImplementation(
      (key: string, defaultValue?: string) => {
        const cfg: Record<string, string> = {
          PAYMENT_PROVIDER: 'mock',
          FRONTEND_URL: 'https://growithnsi.com',
        };
        return cfg[key] ?? defaultValue;
      },
    );
    mockInvoiceService.generateInvoiceNumber.mockResolvedValue(
      'INV-2026-000001',
    );
    mockInvoicePdfService.generateAndUpload.mockResolvedValue(
      'https://r2.dev/test.pdf',
    );
    mockHistoryService.log.mockResolvedValue(undefined);
    mockPrisma.lead.updateMany.mockResolvedValue({ count: 0 });
  });

  // ══════════════════════════════════════════════════════════
  // subscribe()
  // ══════════════════════════════════════════════════════════
  describe('subscribe()', () => {
    const dto = { planUuid: PLAN_UUID };

    it('returns subscriptionId in mock mode when no prior subscription', async () => {
      mockPrisma.distributorSubscription.findUnique.mockResolvedValue(null);
      mockPrisma.distributorPlan.findUnique.mockResolvedValue(mockPlan);

      const result = await service.subscribe(USER_UUID, dto);

      expect(result.subscriptionId).toBeDefined();
      expect(result.subscriptionId).toMatch(/^mock_sub_/);
      expect(result.shortUrl).toBeNull();
    });

    it('throws BadRequestException if user already has ACTIVE subscription', async () => {
      mockPrisma.distributorSubscription.findUnique.mockResolvedValue({
        ...mockSub,
        status: 'ACTIVE',
      });

      await expect(service.subscribe(USER_UUID, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException with paymentMethodUrl if subscription is HALTED', async () => {
      mockPrisma.distributorSubscription.findUnique.mockResolvedValue({
        ...mockSub,
        status: 'HALTED',
      });

      await expect(service.subscribe(USER_UUID, dto)).rejects.toMatchObject({
        response: expect.objectContaining({
          paymentMethodUrl: expect.any(String),
        }),
      });
    });

    it('throws BadRequestException if plan not found', async () => {
      mockPrisma.distributorSubscription.findUnique.mockResolvedValue(null);
      mockPrisma.distributorPlan.findUnique.mockResolvedValue(null);

      await expect(service.subscribe(USER_UUID, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException if plan is inactive', async () => {
      mockPrisma.distributorSubscription.findUnique.mockResolvedValue(null);
      mockPrisma.distributorPlan.findUnique.mockResolvedValue({
        ...mockPlan,
        isActive: false,
      });

      await expect(service.subscribe(USER_UUID, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('allows re-subscribe when previous subscription is CANCELLED', async () => {
      mockPrisma.distributorSubscription.findUnique.mockResolvedValue({
        ...mockSub,
        status: 'CANCELLED',
      });
      mockPrisma.distributorPlan.findUnique.mockResolvedValue(mockPlan);

      const result = await service.subscribe(USER_UUID, dto);

      expect(result.subscriptionId).toBeDefined();
    });

    it('allows re-subscribe when previous subscription is EXPIRED', async () => {
      mockPrisma.distributorSubscription.findUnique.mockResolvedValue({
        ...mockSub,
        status: 'EXPIRED',
      });
      mockPrisma.distributorPlan.findUnique.mockResolvedValue(mockPlan);

      const result = await service.subscribe(USER_UUID, dto);

      expect(result.subscriptionId).toBeDefined();
    });
  });

  // ══════════════════════════════════════════════════════════
  // selfCancelSubscription()
  // ══════════════════════════════════════════════════════════
  describe('selfCancelSubscription()', () => {
    it('throws NotFoundException if no subscription found', async () => {
      mockPrisma.distributorSubscription.findUnique.mockResolvedValue(null);

      await expect(service.selfCancelSubscription(USER_UUID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException if subscription is HALTED', async () => {
      mockPrisma.distributorSubscription.findUnique.mockResolvedValue({
        ...mockSub,
        status: 'HALTED',
      });

      await expect(service.selfCancelSubscription(USER_UUID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException if subscription is CANCELLED', async () => {
      mockPrisma.distributorSubscription.findUnique.mockResolvedValue({
        ...mockSub,
        status: 'CANCELLED',
      });

      await expect(service.selfCancelSubscription(USER_UUID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException if subscription is EXPIRED', async () => {
      mockPrisma.distributorSubscription.findUnique.mockResolvedValue({
        ...mockSub,
        status: 'EXPIRED',
      });

      await expect(service.selfCancelSubscription(USER_UUID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('cancels ACTIVE subscription and logs SELF_CANCELLED history', async () => {
      mockPrisma.distributorSubscription.findUnique.mockResolvedValue({
        ...mockSub,
        status: 'ACTIVE',
      });
      mockPrisma.distributorSubscription.update.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await service.selfCancelSubscription(USER_UUID);

      expect(mockPrisma.distributorSubscription.update).toHaveBeenCalledWith({
        where: { userUuid: USER_UUID },
        data: { status: 'CANCELLED' },
      });
      expect(mockHistoryService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userUuid: USER_UUID,
          event: 'SELF_CANCELLED',
        }),
      );
    });

    it('sends self-cancelled email (fire and forget)', async () => {
      mockPrisma.distributorSubscription.findUnique.mockResolvedValue({
        ...mockSub,
        status: 'ACTIVE',
      });
      mockPrisma.distributorSubscription.update.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await service.selfCancelSubscription(USER_UUID);

      expect(
        mockMailService.sendSubscriptionSelfCancelledEmail,
      ).toHaveBeenCalledWith(
        mockUser.email,
        expect.objectContaining({ fullName: mockUser.fullName }),
      );
    });

    it('returns message and accessUntil date', async () => {
      mockPrisma.distributorSubscription.findUnique.mockResolvedValue({
        ...mockSub,
        status: 'ACTIVE',
      });
      mockPrisma.distributorSubscription.update.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.selfCancelSubscription(USER_UUID);

      expect(result.message).toContain('cancelled');
      expect(result.accessUntil).toEqual(mockSub.currentPeriodEnd);
    });
  });

  // ══════════════════════════════════════════════════════════
  // getPaymentMethodUrl()
  // ══════════════════════════════════════════════════════════
  describe('getPaymentMethodUrl()', () => {
    it('throws BadRequestException if no subscription exists', async () => {
      mockPrisma.distributorSubscription.findUnique.mockResolvedValue(null);

      await expect(service.getPaymentMethodUrl(USER_UUID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException if subscription is not HALTED', async () => {
      mockPrisma.distributorSubscription.findUnique.mockResolvedValue({
        ...mockSub,
        status: 'ACTIVE',
      });

      await expect(service.getPaymentMethodUrl(USER_UUID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns mock payment method URL in mock mode when status is HALTED', async () => {
      mockPrisma.distributorSubscription.findUnique.mockResolvedValue({
        ...mockSub,
        status: 'HALTED',
      });

      const result = await service.getPaymentMethodUrl(USER_UUID);

      expect(result.url).toBe('https://mock-razorpay.com/update-payment');
    });
  });

  // ══════════════════════════════════════════════════════════
  // handleCharged() — webhook
  // ══════════════════════════════════════════════════════════
  describe('handleCharged()', () => {
    const mockSubWithUserAndPlan = {
      ...mockSub,
      user: mockUser,
      plan: mockPlan,
      planUuid: PLAN_UUID,
    };

    beforeEach(() => {
      mockPrisma.distributorSubscription.findUnique.mockResolvedValue(
        mockSubWithUserAndPlan,
      );
      mockPrisma.distributorSubscription.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.user.findFirst.mockResolvedValue(null); // distributorCode already set
      mockPrisma.payment.create.mockResolvedValue({ uuid: PAYMENT_UUID });
      mockPrisma.payment.update.mockResolvedValue({});
    });

    it('creates a payment record with DISTRIBUTOR_SUB paymentType', async () => {
      await service.handleCharged(
        RAZORPAY_SUB,
        new Date('2026-05-09'),
        'pay_rzp_abc',
      );

      expect(mockPrisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userUuid: USER_UUID,
            paymentType: 'DISTRIBUTOR_SUB',
            status: 'SUCCESS',
          }),
        }),
      );
    });

    it('generates an invoice number for the payment', async () => {
      await service.handleCharged(
        RAZORPAY_SUB,
        new Date('2026-05-09'),
        'pay_rzp_abc',
      );

      expect(mockInvoiceService.generateInvoiceNumber).toHaveBeenCalledTimes(1);
      expect(mockPrisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ invoiceNumber: 'INV-2026-000001' }),
        }),
      );
    });

    it('fires generateAndUpload for PDF (fire and forget)', async () => {
      await service.handleCharged(
        RAZORPAY_SUB,
        new Date('2026-05-09'),
        'pay_rzp_abc',
      );

      expect(mockInvoicePdfService.generateAndUpload).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceNumber: 'INV-2026-000001',
          fullName: mockUser.fullName,
          email: mockUser.email,
          planName: mockPlan.name,
          amount: Math.round(mockPlan.amount),
        }),
      );
    });

    it('logs CHARGED event to history', async () => {
      await service.handleCharged(
        RAZORPAY_SUB,
        new Date('2026-05-09'),
        'pay_rzp_abc',
      );

      expect(mockHistoryService.log).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'CHARGED', userUuid: USER_UUID }),
      );
    });

    it('sends invoice email (fire and forget)', async () => {
      await service.handleCharged(
        RAZORPAY_SUB,
        new Date('2026-05-09'),
        'pay_rzp_abc',
      );

      expect(mockMailService.sendSubscriptionInvoiceEmail).toHaveBeenCalledWith(
        mockUser.email,
        expect.objectContaining({
          fullName: mockUser.fullName,
          invoiceNumber: 'INV-2026-000001',
        }),
      );
    });

    it('does nothing (logs warn) if subscription not found', async () => {
      mockPrisma.distributorSubscription.findUnique.mockResolvedValue(null);

      await service.handleCharged('sub_unknown', new Date(), 'pay_abc');

      expect(mockPrisma.payment.create).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════
  // cancelSubscription() — admin cancel
  // ══════════════════════════════════════════════════════════
  describe('cancelSubscription() (admin)', () => {
    const mockSubWithUser = { ...mockSub, user: mockUser };

    it('throws NotFoundException if subscription not found', async () => {
      mockPrisma.distributorSubscription.findUnique.mockResolvedValue(null);

      await expect(
        service.cancelSubscription(SUB_UUID, ADMIN_UUID, '127.0.0.1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('sets subscription status to CANCELLED', async () => {
      mockPrisma.distributorSubscription.findUnique.mockResolvedValue(
        mockSubWithUser,
      );
      mockPrisma.distributorSubscription.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.user.findFirst.mockResolvedValue({ uuid: ADMIN_UUID });
      mockPrisma.lead.updateMany.mockResolvedValue({ count: 0 });

      await service.cancelSubscription(SUB_UUID, ADMIN_UUID, '127.0.0.1');

      expect(mockPrisma.distributorSubscription.update).toHaveBeenCalledWith({
        where: { uuid: SUB_UUID },
        data: { status: 'CANCELLED', cancelledAt: expect.any(Date) },
      });
    });

    it('logs ADMIN_CANCELLED to history', async () => {
      mockPrisma.distributorSubscription.findUnique.mockResolvedValue(
        mockSubWithUser,
      );
      mockPrisma.distributorSubscription.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.user.findFirst.mockResolvedValue({ uuid: ADMIN_UUID });
      mockPrisma.lead.updateMany.mockResolvedValue({ count: 0 });

      await service.cancelSubscription(SUB_UUID, ADMIN_UUID, '127.0.0.1');

      expect(mockHistoryService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'ADMIN_CANCELLED',
          userUuid: USER_UUID,
        }),
      );
    });

    it('sends subscription cancelled by admin email (fire and forget)', async () => {
      mockPrisma.distributorSubscription.findUnique.mockResolvedValue(
        mockSubWithUser,
      );
      mockPrisma.distributorSubscription.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.user.findFirst.mockResolvedValue({ uuid: ADMIN_UUID });
      mockPrisma.lead.updateMany.mockResolvedValue({ count: 0 });

      await service.cancelSubscription(SUB_UUID, ADMIN_UUID, '127.0.0.1');

      expect(
        mockMailService.sendSubscriptionCancelledByAdminEmail,
      ).toHaveBeenCalledWith(mockUser.email, mockUser.fullName);
    });

    it('downgrades user role to CUSTOMER and deactivates join link', async () => {
      mockPrisma.distributorSubscription.findUnique.mockResolvedValue(
        mockSubWithUser,
      );
      mockPrisma.distributorSubscription.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.user.findFirst.mockResolvedValue({ uuid: ADMIN_UUID });
      mockPrisma.lead.updateMany.mockResolvedValue({ count: 0 });

      await service.cancelSubscription(SUB_UUID, ADMIN_UUID, '127.0.0.1');

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uuid: USER_UUID },
          data: expect.objectContaining({
            role: 'CUSTOMER',
            joinLinkActive: false,
          }),
        }),
      );
    });
  });
});
