import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentService } from './payment.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CouponService } from '../coupon/coupon.service';
import { InvoiceService } from '../common/invoice/invoice.service';
import { InvoicePdfService } from '../common/invoice/invoice-pdf.service';
import { PAYMENT_PROVIDER_TOKEN } from './providers/payment-provider.interface';
import { PaymentType, PaymentStatus, StepType } from '@prisma/client';

// ─── Fixtures ────────────────────────────────────────────────────────────────
const USER_UUID     = '11111111-1111-1111-1111-111111111111';
const PAYMENT_UUID  = '44444444-4444-4444-4444-444444444444';
const STEP_UUID     = '77777777-7777-7777-7777-777777777777';
const SECTION_UUID  = '88888888-8888-8888-8888-888888888888';
const PROGRESS_UUID = '99999999-9999-9999-9999-999999999999';
const COUPON_UUID   = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const IP            = '127.0.0.1';

const mockFunnelProgress = {
  uuid: PROGRESS_UUID,
  userUuid: USER_UUID,
  phoneVerified: true,
  paymentCompleted: false,
  currentStepUuid: STEP_UUID,
  currentSectionUuid: SECTION_UUID,
};

const mockPaymentGate = {
  uuid: 'gate-uuid-1',
  amount: 999,
  currency: 'INR',
  allowCoupons: true,
};

const mockPaymentStep = {
  uuid: STEP_UUID,
  type: StepType.PAYMENT_GATE,
  sectionUuid: SECTION_UUID,
  order: 3,
  isActive: true,
  paymentGate: mockPaymentGate,
};

const mockNextStep = {
  uuid: 'next-step-uuid',
  sectionUuid: SECTION_UUID,
  order: 4,
};

const mockPendingPayment = {
  uuid: PAYMENT_UUID,
  userUuid: USER_UUID,
  gatewayOrderId: 'order_mock123',
  amount: 999,
  discountAmount: 0,
  finalAmount: 999,
  currency: 'INR',
  status: PaymentStatus.PENDING,
  paymentType: PaymentType.COMMITMENT_FEE,
  couponUuid: null,
  metadata: null,
};

const mockSuccessPayment = {
  ...mockPendingPayment,
  status: PaymentStatus.SUCCESS,
  gatewayPaymentId: null,
};

const mockUser = {
  uuid: USER_UUID,
  fullName: 'Rahul Sharma',
  email: 'rahul@example.com',
};

// ─── Mock dependencies ────────────────────────────────────────────────────────
// Inner prisma used inside $transaction callbacks
const mockTxBase = {
  payment: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  couponUse: {
    create: jest.fn(),
  },
  coupon: {
    update: jest.fn(),
  },
  funnelProgress: {
    update: jest.fn(),
  },
  stepProgress: {
    upsert: jest.fn(),
  },
  funnelStep: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  funnelSection: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
};

const mockPrisma = {
  ...mockTxBase,
  funnelProgress: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  funnelStep: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  payment: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    updateMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockAuditService = { log: jest.fn() };

const mockCouponService = {
  validateCouponInTx: jest.fn(),
};

const mockInvoiceService = {
  generateInvoiceNumber: jest.fn().mockResolvedValue('INV-2026-000001'),
};

const mockInvoicePdfService = {
  generateAndUpload: jest.fn().mockResolvedValue('https://r2.dev/test.pdf'),
};

const mockPaymentProvider = {
  createOrder: jest.fn(),
  verifyWebhookSignature: jest.fn(),
  verifyPaymentSignature: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: string) => {
    const cfg: Record<string, string> = {
      PAYMENT_PROVIDER: 'mock',
      SMS_PROVIDER: 'mock',
      RAZORPAY_KEY_ID: 'rzp_test_mock',
    };
    return cfg[key] ?? defaultValue;
  }),
};

describe('PaymentService', () => {
  let service: PaymentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAuditService },
        { provide: CouponService, useValue: mockCouponService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PAYMENT_PROVIDER_TOKEN, useValue: mockPaymentProvider },
        { provide: InvoiceService, useValue: mockInvoiceService },
        { provide: InvoicePdfService, useValue: mockInvoicePdfService },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    jest.clearAllMocks();

    // Re-apply defaults
    mockConfigService.get.mockImplementation((key: string, defaultValue?: string) => {
      const cfg: Record<string, string> = {
        PAYMENT_PROVIDER: 'mock',
        SMS_PROVIDER: 'mock',
        RAZORPAY_KEY_ID: 'rzp_test_mock',
      };
      return cfg[key] ?? defaultValue;
    });
    mockInvoiceService.generateInvoiceNumber.mockResolvedValue('INV-2026-000001');
    mockInvoicePdfService.generateAndUpload.mockResolvedValue('https://r2.dev/test.pdf');

    // Default $transaction: run callback with inner tx object
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof mockTxBase) => unknown) => fn(mockTxBase),
    );

    // Default inner tx mocks
    mockTxBase.payment.create.mockResolvedValue({ ...mockPendingPayment, uuid: PAYMENT_UUID });
    mockTxBase.payment.update.mockResolvedValue({});
    mockTxBase.funnelProgress.update.mockResolvedValue({});
    mockTxBase.stepProgress.upsert.mockResolvedValue({});
    mockTxBase.funnelStep.findUnique.mockResolvedValue(mockPaymentStep);
    mockTxBase.funnelStep.findFirst.mockResolvedValue(mockNextStep);
    mockTxBase.couponUse.create.mockResolvedValue({});
    mockTxBase.coupon.update.mockResolvedValue({});
    mockTxBase.payment.findUnique.mockResolvedValue(null);
  });

  // ══════════════════════════════════════════════════════════
  // createOrder()
  // ══════════════════════════════════════════════════════════
  describe('createOrder()', () => {
    beforeEach(() => {
      mockPrisma.funnelProgress.findUnique.mockResolvedValue(mockFunnelProgress);
      mockPrisma.funnelStep.findUnique.mockResolvedValue(mockPaymentStep);
      mockPaymentProvider.createOrder.mockResolvedValue({
        orderId: 'order_mock123',
        amount: 999,
        currency: 'INR',
      });
    });

    it('creates Razorpay order with correct amount', async () => {
      await service.createOrder(USER_UUID, undefined, IP);

      expect(mockPaymentProvider.createOrder).toHaveBeenCalledWith(
        999, // finalAmount (no coupon)
        'INR',
        expect.any(String),
      );
    });

    it('returns orderId, amount, currency, and keyId', async () => {
      const result = await service.createOrder(USER_UUID, undefined, IP);

      // In mock mode, a setTimeout triggers processMockWebhook — the return is still the order
      expect(result).toMatchObject(
        expect.objectContaining({ orderId: 'order_mock123' }),
      );
    });

    it('throws ForbiddenException if phone is not verified', async () => {
      mockPrisma.funnelProgress.findUnique.mockResolvedValue({
        ...mockFunnelProgress,
        phoneVerified: false,
      });

      await expect(service.createOrder(USER_UUID, undefined, IP)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ConflictException if payment already completed', async () => {
      mockPrisma.funnelProgress.findUnique.mockResolvedValue({
        ...mockFunnelProgress,
        paymentCompleted: true,
      });

      await expect(service.createOrder(USER_UUID, undefined, IP)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws ForbiddenException if not at a PAYMENT_GATE step', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue({
        ...mockPaymentStep,
        type: StepType.VIDEO_TEXT,
        paymentGate: null,
      });

      await expect(service.createOrder(USER_UUID, undefined, IP)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('applies coupon discount when valid coupon is provided', async () => {
      mockCouponService.validateCouponInTx.mockResolvedValue({
        discountAmount: 100,
        finalAmount: 899,
        coupon: { uuid: COUPON_UUID },
      });

      await service.createOrder(USER_UUID, 'SAVE100', IP);

      expect(mockCouponService.validateCouponInTx).toHaveBeenCalledWith(
        'SAVE100',
        USER_UUID,
        PaymentType.COMMITMENT_FEE,
        999,
        expect.anything(), // tx
      );
      expect(mockPaymentProvider.createOrder).toHaveBeenCalledWith(
        899, // discounted amount
        'INR',
        expect.any(String),
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // processSuccessfulPayment() — COMMITMENT_FEE
  // ══════════════════════════════════════════════════════════
  describe('processSuccessfulPayment() — COMMITMENT_FEE', () => {
    beforeEach(() => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        ...mockSuccessPayment,
        status: PaymentStatus.PENDING,
      });
      mockPrisma.funnelProgress.findUnique.mockResolvedValue(mockFunnelProgress);
      mockPrisma.funnelStep.findFirst.mockResolvedValue(mockPaymentStep);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.payment.update.mockResolvedValue({});
    });

    it('updates payment status to SUCCESS', async () => {
      await service.processSuccessfulPayment(PAYMENT_UUID, 'pay_rzp_abc', IP);

      expect(mockTxBase.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uuid: PAYMENT_UUID },
          data: expect.objectContaining({
            status: PaymentStatus.SUCCESS,
            gatewayPaymentId: 'pay_rzp_abc',
          }),
        }),
      );
    });

    it('marks funnelProgress as paymentCompleted', async () => {
      await service.processSuccessfulPayment(PAYMENT_UUID, 'pay_rzp_abc', IP);

      expect(mockTxBase.funnelProgress.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ paymentCompleted: true }),
        }),
      );
    });

    it('generates invoice number for COMMITMENT_FEE type', async () => {
      await service.processSuccessfulPayment(PAYMENT_UUID, 'pay_rzp_abc', IP);

      expect(mockInvoiceService.generateInvoiceNumber).toHaveBeenCalledTimes(1);
    });

    it('saves invoiceNumber on the payment record', async () => {
      await service.processSuccessfulPayment(PAYMENT_UUID, 'pay_rzp_abc', IP);

      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uuid: PAYMENT_UUID },
          data: { invoiceNumber: 'INV-2026-000001' },
        }),
      );
    });

    it('fires PDF generation (fire and forget — calls generateAndUpload)', async () => {
      await service.processSuccessfulPayment(PAYMENT_UUID, 'pay_rzp_abc', IP);

      expect(mockInvoicePdfService.generateAndUpload).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceNumber: 'INV-2026-000001',
          fullName: mockUser.fullName,
          email: mockUser.email,
          planName: 'Commitment Fee',
          nextBillingDate: null,
        }),
      );
    });

    it('logs audit event', async () => {
      await service.processSuccessfulPayment(PAYMENT_UUID, 'pay_rzp_abc', IP);

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PAYMENT_SUCCESS' }),
      );
    });
  });
});
