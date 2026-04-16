import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CouponScope, CouponType, PaymentType } from '@prisma/client';
import { CouponService } from './coupon.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  $transaction: jest
    .fn()
    .mockImplementation((args: Promise<unknown>[]) => Promise.all(args)),
  coupon: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  couponUse: {
    count: jest.fn(),
  },
};

describe('CouponService', () => {
  let service: CouponService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CouponService>(CouponService);
    jest.clearAllMocks();

    mockPrisma.coupon.findUnique.mockResolvedValue(null);
    mockPrisma.coupon.findMany.mockResolvedValue([]);
    mockPrisma.coupon.count.mockResolvedValue(0);
    mockPrisma.couponUse.count.mockResolvedValue(0);
  });

  describe('validateCoupon', () => {
    const validCoupon = {
      uuid: 'c1',
      code: 'SAVE10',
      isActive: true,
      expiresAt: null,
      usageLimit: null,
      usedCount: 0,
      perUserLimit: 1,
      applicableTo: CouponScope.ALL,
      type: CouponType.FLAT,
      value: 100,
    };

    it('throws NotFoundException if coupon missing', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue(null);
      await expect(
        service.validateCoupon(
          'INVALID',
          'user1',
          PaymentType.LMS_COURSE,
          1000,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if inactive', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue({
        ...validCoupon,
        isActive: false,
      });
      await expect(
        service.validateCoupon('SAVE10', 'user1', PaymentType.LMS_COURSE, 1000),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if expired', async () => {
      const pastDate = new Date();
      pastDate.setFullYear(2020);
      mockPrisma.coupon.findUnique.mockResolvedValue({
        ...validCoupon,
        expiresAt: pastDate,
      });
      await expect(
        service.validateCoupon('SAVE10', 'user1', PaymentType.LMS_COURSE, 1000),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if global usage limit reached', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue({
        ...validCoupon,
        usageLimit: 5,
        usedCount: 5,
      });
      await expect(
        service.validateCoupon('SAVE10', 'user1', PaymentType.LMS_COURSE, 1000),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if per-user limit reached', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue(validCoupon);
      mockPrisma.couponUse.count.mockResolvedValue(1);
      await expect(
        service.validateCoupon('SAVE10', 'user1', PaymentType.LMS_COURSE, 1000),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if scope mismatch', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue({
        ...validCoupon,
        applicableTo: CouponScope.DISTRIBUTOR_SUB,
      });
      await expect(
        service.validateCoupon('SAVE10', 'user1', PaymentType.LMS_COURSE, 1000),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns discount amount for Flat', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue(validCoupon);
      const result = await service.validateCoupon(
        'SAVE10',
        'user1',
        PaymentType.LMS_COURSE,
        1000,
      );
      expect(result.discountAmount).toBe(100);
      expect(result.finalAmount).toBe(900);
    });

    it('returns discount amount for Percent', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue({
        ...validCoupon,
        type: CouponType.PERCENT,
        value: 15,
      });
      const result = await service.validateCoupon(
        'SAVE10',
        'user1',
        PaymentType.LMS_COURSE,
        1000,
      );
      expect(result.discountAmount).toBe(150);
    });

    it('returns free for Free type', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue({
        ...validCoupon,
        type: CouponType.FREE,
      });
      const result = await service.validateCoupon(
        'SAVE10',
        'user1',
        PaymentType.LMS_COURSE,
        1000,
      );
      expect(result.discountAmount).toBe(1000);
      expect(result.finalAmount).toBe(0);
    });
  });

  describe('validateCouponInTx', () => {
    const mockTx = {
      coupon: { findUnique: jest.fn() },
      couponUse: { count: jest.fn() },
    };

    it('works correctly inside a transaction', async () => {
      mockTx.coupon.findUnique.mockResolvedValue({
        uuid: 'c1',
        isActive: true,
        expiresAt: null,
        usageLimit: null,
        usedCount: 0,
        perUserLimit: 1,
        applicableTo: CouponScope.ALL,
        type: CouponType.FLAT,
        value: 50,
      });
      mockTx.couponUse.count.mockResolvedValue(0);

      const result = await service.validateCouponInTx(
        'TXCODE',
        'u1',
        PaymentType.LMS_COURSE,
        100,
        mockTx,
      );
      expect(result.discountAmount).toBe(50);
    });
  });

  describe('createCoupon', () => {
    it('creates a valid coupon', async () => {
      const dto = {
        code: ' NEWCODE ',
        type: CouponType.FLAT,
        value: 10,
        applicableTo: CouponScope.ALL,
        perUserLimit: 1,
      };
      mockPrisma.coupon.findUnique.mockResolvedValue(null);
      mockPrisma.coupon.create.mockResolvedValue({
        ...dto,
        code: 'NEWCODE',
        isActive: true,
      });

      const result = await service.createCoupon(dto);
      expect(mockPrisma.coupon.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ code: 'NEWCODE' }),
        }),
      );
      expect(result.status).toBe('ACTIVE');
    });

    it('throws ConflictException if code exists', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue({ id: 1 });
      await expect(
        service.createCoupon({
          code: 'EXISTS',
          type: CouponType.FLAT,
          value: 10,
          applicableTo: CouponScope.ALL,
          perUserLimit: 1,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject coupons with a past expiry date', async () => {
      await expect(
        service.createCoupon({
          code: 'SAVE10',
          type: CouponType.PERCENT,
          value: 10,
          applicableTo: CouponScope.COMMITMENT_FEE,
          expiresAt: '2020-01-01T00:00:00.000Z',
          perUserLimit: 1,
        }),
      ).rejects.toThrow(
        new BadRequestException('Expiry date must be in the future'),
      );

      expect(mockPrisma.coupon.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.coupon.create).not.toHaveBeenCalled();
    });
  });

  describe('listCoupons', () => {
    it('returns mapped array of coupons with statuses', async () => {
      mockPrisma.coupon.findMany.mockResolvedValue([
        { isActive: true, expiresAt: null },
        { isActive: false, expiresAt: null },
      ]);
      mockPrisma.coupon.count.mockResolvedValue(2);
      const results = await service.listCoupons('all');
      expect(results.data[0].status).toBe('ACTIVE');
      expect(results.data[1].status).toBe('INACTIVE');
      expect(results.total).toBe(2);
    });
  });

  describe('getCouponDetail', () => {
    it('returns detail', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue({
        isActive: true,
        expiresAt: null,
      });
      const result = await service.getCouponDetail('uuid');
      expect(result.status).toBe('ACTIVE');
    });

    it('throws Not Found', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue(null);
      await expect(service.getCouponDetail('uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getCouponForUpdate', () => {
    it('returns updatable fields', async () => {
      const date = new Date();
      mockPrisma.coupon.findUnique.mockResolvedValue({
        isActive: false,
        expiresAt: date,
        usageLimit: 10,
      });
      const result = await service.getCouponForUpdate('uuid');
      expect(result.isActive).toBe(false);
      expect(result.expiresAt).toBe(date.toISOString());
    });

    it('throws Not Found', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue(null);
      await expect(service.getCouponForUpdate('uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateCoupon', () => {
    it('updates correctly', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue({
        isActive: true,
        expiresAt: null,
      });
      mockPrisma.coupon.update.mockResolvedValue({
        isActive: false,
        expiresAt: null,
      });

      const result = await service.updateCoupon('uuid', { isActive: false });
      expect(mockPrisma.coupon.update).toHaveBeenCalled();
      expect(result.status).toBe('INACTIVE');
    });

    it('throws BadRequestException for reactivating expired coupon', async () => {
      const past = new Date();
      past.setFullYear(2020);
      mockPrisma.coupon.findUnique.mockResolvedValue({
        isActive: false,
        expiresAt: past,
      });

      await expect(
        service.updateCoupon('uuid', { isActive: true }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject updating expiry date to a past date', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue({
        uuid: 'coupon-1',
        expiresAt: null,
        isActive: true,
      });

      await expect(
        service.updateCoupon('coupon-1', {
          expiresAt: '2020-01-01T00:00:00.000Z',
        }),
      ).rejects.toThrow(
        new BadRequestException('Expiry date must be in the future'),
      );

      expect(mockPrisma.coupon.update).not.toHaveBeenCalled();
    });

    it('throws Not Found', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue(null);
      await expect(
        service.updateCoupon('uuid', { isActive: true }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteCoupon', () => {
    it('soft deletes if used', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue({ usedCount: 1 });
      const result = await service.deleteCoupon('uuid');
      expect(mockPrisma.coupon.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } }),
      );
      expect(result.message).toContain('Coupon deactivated');
    });

    it('hard deletes if never used', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue({ usedCount: 0 });
      const result = await service.deleteCoupon('uuid');
      expect(mockPrisma.coupon.delete).toHaveBeenCalled();
      expect(result.message).toContain('permanently');
    });

    it('throws Not Found', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue(null);
      await expect(service.deleteCoupon('uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
