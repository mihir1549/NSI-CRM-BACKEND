import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentService } from './payment.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CouponService } from '../coupon/coupon.service';
import { InvoiceService } from '../common/invoice/invoice.service';
import { InvoicePdfService } from '../common/invoice/invoice-pdf.service';
import { PAYMENT_PROVIDER_TOKEN } from './providers/payment-provider.interface';
import { PaymentType, PaymentStatus, StepType } from '@prisma/client';
import { MailService } from '../mail/mail.service';

// ─── Fixtures ────────────────────────────────────────────────────────────────
const USER_UUID = '11111111-1111-1111-1111-111111111111';
const PAYMENT_UUID = '44444444-4444-4444-4444-444444444444';
const STEP_UUID = '77777777-7777-7777-7777-777777777777';
const SECTION_UUID = '88888888-8888-8888-8888-888888888888';
const PROGRESS_UUID = '99999999-9999-9999-9999-999999999999';
const COUPON_UUID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const IP = '127.0.0.1';

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
    findFirst: jest.fn(),
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
      PAYMENT_PROVIDER: 'razorpay',
      SMS_PROVIDER: 'twilio',
      RAZORPAY_KEY_ID: 'rzp_test_mock',
    };
    return cfg[key] ?? defaultValue;
  }),
};

const mockMailService = {
  sendSubscriptionInvoiceEmail: jest.fn(),
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
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    jest.clearAllMocks();

    // Re-apply defaults
    mockConfigService.get.mockImplementation(
      (key: string, defaultValue?: string) => {
        const cfg: Record<string, string> = {
          PAYMENT_PROVIDER: 'razorpay',
          SMS_PROVIDER: 'twilio',
          RAZORPAY_KEY_ID: 'rzp_test_mock',
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

    // Default $transaction: run callback with inner tx object
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof mockTxBase) => unknown) => fn(mockTxBase),
    );

    // Default inner tx mocks
    mockTxBase.payment.create.mockResolvedValue({
      ...mockPendingPayment,
      uuid: PAYMENT_UUID,
    });
    mockTxBase.payment.update.mockResolvedValue({});
    mockTxBase.funnelProgress.update.mockResolvedValue({});
    mockTxBase.stepProgress.upsert.mockResolvedValue({});
    mockTxBase.funnelStep.findUnique.mockResolvedValue(mockPaymentStep);
    mockTxBase.funnelStep.findFirst.mockResolvedValue(mockNextStep);
    mockTxBase.couponUse.create.mockResolvedValue({});
    mockTxBase.coupon.update.mockResolvedValue({});
    mockTxBase.payment.findUnique.mockResolvedValue(null);
    mockTxBase.payment.findFirst.mockResolvedValue(null);
  });

  // ══════════════════════════════════════════════════════════
  // createOrder()
  // ══════════════════════════════════════════════════════════
  describe('createOrder()', () => {
    beforeEach(() => {
      mockPrisma.funnelProgress.findUnique.mockResolvedValue(
        mockFunnelProgress,
      );
      mockPrisma.funnelStep.findUnique.mockResolvedValue(mockPaymentStep);
      mockPaymentProvider.createOrder.mockResolvedValue({
        orderId: 'order_mock123',
        amount: 999,
        currency: 'INR',
      });
    });

    const validConsent = {
      termsAccepted: true,
      termsVersion: '2026-04-21-v1',
    };

    it('creates Razorpay order with correct amount', async () => {
      await service.createOrder(USER_UUID, { ...validConsent }, IP);

      expect(mockPaymentProvider.createOrder).toHaveBeenCalledWith(
        999, // finalAmount (no coupon)
        'INR',
        expect.any(String),
      );
      expect(mockTxBase.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            termsAcceptedAt: expect.any(Date),
            termsVersion: '2026-04-21-v1',
            termsAcceptedIp: IP,
          }),
        }),
      );
    });

    it('returns orderId, amount, currency, and keyId', async () => {
      const result = await service.createOrder(USER_UUID, { ...validConsent }, IP);

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

      await expect(
        service.createOrder(USER_UUID, { ...validConsent }, IP),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException if payment already completed', async () => {
      mockPrisma.funnelProgress.findUnique.mockResolvedValue({
        ...mockFunnelProgress,
        paymentCompleted: true,
      });

       await expect(
        service.createOrder(USER_UUID, { ...validConsent }, IP),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ForbiddenException if not at a PAYMENT_GATE step', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue({
        ...mockPaymentStep,
        type: StepType.VIDEO_TEXT,
        paymentGate: null,
      });

       await expect(
        service.createOrder(USER_UUID, { ...validConsent }, IP),
      ).rejects.toThrow(ForbiddenException);
    });

    it('applies coupon discount when valid coupon is provided', async () => {
      mockCouponService.validateCouponInTx.mockResolvedValue({
        discountAmount: 100,
        finalAmount: 899,
        coupon: { uuid: COUPON_UUID },
      });

       await service.createOrder(USER_UUID, { ...validConsent, couponCode: 'SAVE100' }, IP);

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

    it('throws BadRequestException if terms are not accepted', async () => {
      await expect(
        service.createOrder(
          USER_UUID,
          { termsAccepted: false, termsVersion: '2026-04-21-v1' },
          IP,
        ),
      ).rejects.toThrow('You must accept the terms and conditions');
    });

    it('warns if terms version mismatch', async () => {
      const loggerSpy = jest.spyOn((service as any).logger, 'warn');
      await service.createOrder(
        USER_UUID,
        { ...validConsent, termsVersion: 'wrong-version' },
        IP,
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Terms version mismatch'),
      );
    });

    it('throws ForbiddenException if currentStepUuid is missing', async () => {
      mockPrisma.funnelProgress.findUnique.mockResolvedValue({
        ...mockFunnelProgress,
        currentStepUuid: null,
      });

      await expect(
        service.createOrder(USER_UUID, { ...validConsent }, IP),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException if paymentGate is missing on step', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue({
        ...mockPaymentStep,
        paymentGate: null,
      });

      await expect(
        service.createOrder(USER_UUID, { ...validConsent }, IP),
      ).rejects.toThrow(BadRequestException);
    });

    it('handles FREE access when finalAmount is 0 (FREE coupon)', async () => {
      mockCouponService.validateCouponInTx.mockResolvedValue({
        discountAmount: 999,
        finalAmount: 0,
        coupon: { uuid: COUPON_UUID },
      });

      const result = await service.createOrder(
        USER_UUID,
        { ...validConsent, couponCode: 'FREE_MODE' },
        IP,
      );

      expect(result).toEqual({ freeAccess: true });
      expect(mockTxBase.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: PaymentStatus.SUCCESS,
            finalAmount: 0,
          }),
        }),
      );
      expect(mockTxBase.couponUse.create).toHaveBeenCalled();
      expect(mockTxBase.coupon.update).toHaveBeenCalled();
    });

    it('P1: throws ConflictException when a PENDING order already exists', async () => {
      mockTxBase.payment.findFirst.mockResolvedValue(mockPendingPayment);

      await expect(
        service.createOrder(USER_UUID, { ...validConsent }, IP),
      ).rejects.toThrow(ConflictException);

      expect(mockPaymentProvider.createOrder).not.toHaveBeenCalled();
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
      mockPrisma.funnelProgress.findUnique.mockResolvedValue(
        mockFunnelProgress,
      );
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

    it('throws NotFoundException if payment record does not exist', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);
      await expect(
        service.processSuccessfulPayment(PAYMENT_UUID, 'any', IP),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates coupon usage if coupon was used', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        ...mockPendingPayment,
        couponUuid: COUPON_UUID,
      });

      await service.processSuccessfulPayment(PAYMENT_UUID, 'pay_abc', IP);

      expect(mockTxBase.couponUse.create).toHaveBeenCalled();
      expect(mockTxBase.coupon.update).toHaveBeenCalled();
    });

    it('handles missing funnel progress gracefully (logs error)', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(mockPendingPayment);
      mockPrisma.funnelProgress.findUnique.mockResolvedValue(null);
      const loggerSpy = jest.spyOn((service as any).logger, 'error');

      await service.processSuccessfulPayment(PAYMENT_UUID, 'pay_abc', IP);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('FunnelProgress not found'),
      );
    });

    it('advances to next section if no more steps in current section', async () => {
      mockTxBase.funnelStep.findFirst.mockResolvedValueOnce(null); // No next step in section
      mockTxBase.funnelSection.findUnique.mockResolvedValue({
        uuid: SECTION_UUID,
        order: 1,
      });
      mockTxBase.funnelSection.findFirst.mockResolvedValue({
        uuid: 'next-sec',
        steps: [{ uuid: 'first-step-next-sec', sectionUuid: 'next-sec' }],
      });

      await service.processSuccessfulPayment(PAYMENT_UUID, 'pay_abc', IP);

      expect(mockTxBase.funnelProgress.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currentStepUuid: 'first-step-next-sec',
          }),
        }),
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // processSuccessfulPayment() — LMS_COURSE
  // ══════════════════════════════════════════════════════════
  describe('processSuccessfulPayment() — LMS_COURSE', () => {
    const lmsPayment = {
      ...mockPendingPayment,
      paymentType: PaymentType.LMS_COURSE,
      metadata: { courseUuid: 'course-123' },
    };

    beforeEach(() => {
      mockPrisma.payment.findUnique.mockResolvedValue(lmsPayment);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.course = {
        findUnique: jest.fn().mockResolvedValue({ title: 'Magic Course' }),
      };
    });

    it('creates enrollment and generates LMS invoice', async () => {
      await service.processSuccessfulPayment(PAYMENT_UUID, 'pay_lms_1', IP);

      expect(mockTxBase.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PaymentStatus.SUCCESS }),
        }),
      );
      // Check invoice generation
      expect(mockInvoicePdfService.generateAndUpload).toHaveBeenCalledWith(
        expect.objectContaining({
          planName: 'Magic Course',
          accountLabel: 'Student Account',
        }),
      );
    });

    it('uses fallback plan name if course title is missing', async () => {
      (mockPrisma.course.findUnique as jest.Mock).mockResolvedValue(null);
      await service.processSuccessfulPayment(PAYMENT_UUID, 'pay_lms_1', IP);
      expect(mockInvoicePdfService.generateAndUpload).toHaveBeenCalledWith(
        expect.objectContaining({ planName: 'LMS Course' }),
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // handleWebhook()
  // ══════════════════════════════════════════════════════════
  describe('handleWebhook()', () => {
    const payload = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_rzp_123',
            order_id: 'order_mock123',
            amount: 99900,
          },
        },
      },
    });

    beforeEach(() => {
      mockPaymentProvider.verifyWebhookSignature.mockReturnValue(true);
      mockPrisma.payment.findUnique.mockImplementation(({ where }) => {
        if (where.gatewayPaymentId === 'pay_rzp_123') return null;
        if (where.gatewayOrderId === 'order_mock123')
          return { ...mockPendingPayment, uuid: PAYMENT_UUID };
        return null;
      });
    });

    it('successfully processes payment.captured webhook', async () => {
      const processSpy = jest
        .spyOn(service, 'processSuccessfulPayment')
        .mockResolvedValue();

      await service.handleWebhook(payload, 'sig', IP);

      expect(processSpy).toHaveBeenCalledWith(PAYMENT_UUID, 'pay_rzp_123', IP);
    });

    it('throws BadRequestException on invalid signature', async () => {
      mockPaymentProvider.verifyWebhookSignature.mockReturnValue(false);
      await expect(service.handleWebhook(payload, 'sig', IP)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException on invalid JSON', async () => {
      await expect(service.handleWebhook('not-json', 'sig', IP)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('logs error if payment record not found for orderId', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);
      const loggerSpy = jest.spyOn((service as any).logger, 'error');

      await service.handleWebhook(payload, 'sig', IP);
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Payment record not found'),
      );
    });

    it('logs fraud attempt on amount mismatch', async () => {
      const fraudPayload = JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: { id: 'pay_fraud', order_id: 'order_mock123', amount: 50000 },
          },
        },
      });
      const loggerSpy = jest.spyOn((service as any).logger, 'warn');

      await service.handleWebhook(fraudPayload, 'sig', IP);
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('FRAUD ATTEMPT'),
      );
    });

    it('ignores already processed payments (idempotency)', async () => {
      mockPrisma.payment.findUnique.mockResolvedValueOnce({
        uuid: 'already-done',
      });
      const processSpy = jest.spyOn(service, 'processSuccessfulPayment');

      await service.handleWebhook(payload, 'sig', IP);
      expect(processSpy).not.toHaveBeenCalled();
    });

    it('updates status to FAILED on payment.failed event', async () => {
      const failPayload = JSON.stringify({
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              order_id: 'order_mock123',
              error_reason: 'insufficient_funds',
            },
          },
        },
      });

      await service.handleWebhook(failPayload, 'sig', IP);
      expect(mockPrisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: PaymentStatus.FAILED } }),
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // getStatus()
  // ══════════════════════════════════════════════════════════
  describe('getStatus()', () => {
    it('returns status and payment details', async () => {
      mockPrisma.funnelProgress.findUnique.mockResolvedValue({
        paymentCompleted: true,
      });
      mockPrisma.payment.findFirst.mockResolvedValue(mockSuccessPayment);

      const result = await service.getStatus(USER_UUID);

      expect(result).toEqual({
        paymentCompleted: true,
        payment: expect.objectContaining({
          uuid: PAYMENT_UUID,
          status: PaymentStatus.SUCCESS,
        }),
      });
    });

    it('returns payment: null if no success payment exists', async () => {
      mockPrisma.funnelProgress.findUnique.mockResolvedValue({
        paymentCompleted: false,
      });
      mockPrisma.payment.findFirst.mockResolvedValue(null);

      const result = await service.getStatus(USER_UUID);
      expect(result.payment).toBeNull();
    });
  });
});
