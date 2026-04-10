import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnrollmentService } from './enrollment.service';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_PROVIDER_TOKEN } from '../payment/providers/payment-provider.interface';
import { PaymentStatus } from '@prisma/client';

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const USER_UUID   = '11111111-1111-1111-1111-111111111111';
const COURSE_UUID = '22222222-2222-2222-2222-222222222222';
const PAYMENT_UUID = '33333333-3333-3333-3333-333333333333';

const mockFreeCourse = {
  uuid: COURSE_UUID,
  title: 'Free Course',
  isPublished: true,
  isFree: true,
  price: null,
};

const mockPaidCourse = {
  uuid: COURSE_UUID,
  title: 'Paid Course',
  isPublished: true,
  isFree: false,
  price: 1000,
};

const mockEnrollment = {
  uuid: 'enroll-1111-1111-1111-111111111111',
  userUuid: USER_UUID,
  courseUuid: COURSE_UUID,
};

// ─── Mocks ────────────────────────────────────────────────────────────────────
const mockPrisma = {
  course: {
    findUnique: jest.fn(),
  },
  courseEnrollment: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  payment: {
    create: jest.fn(),
    update: jest.fn(),
  },
};

const mockPaymentProvider = {
  createOrder: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: string) => {
    const cfg: Record<string, string> = {
      PAYMENT_PROVIDER: 'mock',
      RAZORPAY_KEY_ID: 'rzp_test_key',
    };
    return cfg[key] ?? defaultValue;
  }),
};

describe('EnrollmentService', () => {
  let service: EnrollmentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnrollmentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PAYMENT_PROVIDER_TOKEN, useValue: mockPaymentProvider },
      ],
    }).compile();

    service = module.get<EnrollmentService>(EnrollmentService);
    jest.resetAllMocks();

    mockConfigService.get.mockImplementation((key: string, defaultValue?: string) => {
      const cfg: Record<string, string> = {
        PAYMENT_PROVIDER: 'mock',
        RAZORPAY_KEY_ID: 'rzp_test_key',
      };
      return cfg[key] ?? defaultValue;
    });

    mockPrisma.course.findUnique.mockResolvedValue(mockFreeCourse);
    mockPrisma.courseEnrollment.findUnique.mockResolvedValue(null);
    mockPrisma.courseEnrollment.create.mockResolvedValue(mockEnrollment);
    mockPrisma.payment.create.mockResolvedValue({ uuid: PAYMENT_UUID });
    mockPrisma.payment.update.mockResolvedValue({});
    mockPaymentProvider.createOrder.mockResolvedValue({
      orderId: 'order_mock123',
      amount: 100000,
      currency: 'INR',
    });
  });

  // ══════════════════════════════════════════════════════════
  // enrollFree()
  // ══════════════════════════════════════════════════════════
  describe('enrollFree()', () => {
    it('creates enrollment for a free published course', async () => {
      const result = await service.enrollFree(USER_UUID, COURSE_UUID);

      expect(result.enrolled).toBe(true);
      expect(result.message).toBe('Enrolled successfully');
      expect(mockPrisma.courseEnrollment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { userUuid: USER_UUID, courseUuid: COURSE_UUID } }),
      );
    });

    it('throws NotFoundException when course not found', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(null);

      await expect(service.enrollFree(USER_UUID, COURSE_UUID)).rejects.toThrow('Course not found');
    });

    it('throws BadRequestException when course is not published', async () => {
      mockPrisma.course.findUnique.mockResolvedValue({ ...mockFreeCourse, isPublished: false });

      await expect(service.enrollFree(USER_UUID, COURSE_UUID)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when course is not free', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(mockPaidCourse);

      await expect(service.enrollFree(USER_UUID, COURSE_UUID)).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException when user is already enrolled', async () => {
      mockPrisma.courseEnrollment.findUnique.mockResolvedValue(mockEnrollment);

      await expect(service.enrollFree(USER_UUID, COURSE_UUID)).rejects.toThrow(ConflictException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // initiatePaidEnrollment()
  // ══════════════════════════════════════════════════════════
  describe('initiatePaidEnrollment()', () => {
    beforeEach(() => {
      mockPrisma.course.findUnique.mockResolvedValue(mockPaidCourse);
    });

    it('returns orderId, amount, currency, keyId for paid course', async () => {
      const result = await service.initiatePaidEnrollment(USER_UUID, COURSE_UUID);

      expect(result.orderId).toBe('order_mock123');
      expect(result.amount).toBe(100000); // 1000 * 100 paise
      expect(result.currency).toBe('INR');
      expect(result.keyId).toBe('rzp_test_key');
    });

    it('creates a payment record in PENDING status', async () => {
      await service.initiatePaidEnrollment(USER_UUID, COURSE_UUID);

      expect(mockPrisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userUuid: USER_UUID,
            status: PaymentStatus.PENDING,
          }),
        }),
      );
    });

    it('throws NotFoundException when course not found', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(null);

      await expect(service.initiatePaidEnrollment(USER_UUID, COURSE_UUID)).rejects.toThrow('Course not found');
    });

    it('throws BadRequestException when course is not published', async () => {
      mockPrisma.course.findUnique.mockResolvedValue({ ...mockPaidCourse, isPublished: false });

      await expect(service.initiatePaidEnrollment(USER_UUID, COURSE_UUID)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when course is free', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(mockFreeCourse);

      await expect(service.initiatePaidEnrollment(USER_UUID, COURSE_UUID)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when course price is not configured', async () => {
      mockPrisma.course.findUnique.mockResolvedValue({ ...mockPaidCourse, price: null });

      await expect(service.initiatePaidEnrollment(USER_UUID, COURSE_UUID)).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException when user is already enrolled', async () => {
      mockPrisma.courseEnrollment.findUnique.mockResolvedValue(mockEnrollment);

      await expect(service.initiatePaidEnrollment(USER_UUID, COURSE_UUID)).rejects.toThrow(ConflictException);
    });

    it('updates payment record with real gatewayOrderId after order creation', async () => {
      await service.initiatePaidEnrollment(USER_UUID, COURSE_UUID);

      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { gatewayOrderId: 'order_mock123' },
        }),
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // getEnrollment()
  // ══════════════════════════════════════════════════════════
  describe('getEnrollment()', () => {
    it('returns enrollment when found', async () => {
      mockPrisma.courseEnrollment.findUnique.mockResolvedValue(mockEnrollment);

      const result = await service.getEnrollment(USER_UUID, COURSE_UUID);

      expect(result).toEqual(mockEnrollment);
    });

    it('returns null when not enrolled', async () => {
      mockPrisma.courseEnrollment.findUnique.mockResolvedValue(null);

      const result = await service.getEnrollment(USER_UUID, COURSE_UUID);

      expect(result).toBeNull();
    });
  });

  // ══════════════════════════════════════════════════════════
  // enroll()
  // ══════════════════════════════════════════════════════════
  describe('enroll()', () => {
    it('routes to enrollFree for a free course', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(mockFreeCourse);

      const result = await service.enroll(USER_UUID, COURSE_UUID) as any;

      expect(result.enrolled).toBe(true);
    });

    it('routes to initiatePaidEnrollment for a paid course', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(mockPaidCourse);

      const result = await service.enroll(USER_UUID, COURSE_UUID) as any;

      expect(result.orderId).toBe('order_mock123');
    });

    it('throws NotFoundException when course not found', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(null);

      await expect(service.enroll(USER_UUID, COURSE_UUID)).rejects.toThrow();
    });
  });
});
