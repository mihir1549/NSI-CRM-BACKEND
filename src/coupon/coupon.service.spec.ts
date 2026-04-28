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

    it('R3: throws BadRequestException with generic message if coupon missing', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue(null);
      await expect(
        service.validateCoupon('INVALID', 'user1', PaymentType.LMS_COURSE, 1000),
      ).rejects.toThrow('This coupon code is not valid or has expired');
    });

    it('R3: throws BadRequestException with generic message if inactive', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue({
        ...validCoupon,
        isActive: false,
      });
      await expect(
        service.validateCoupon('SAVE10', 'user1', PaymentType.LMS_COURSE, 1000),
      ).rejects.toThrow('This coupon code is not valid or has expired');
    });

    it('R3: throws BadRequestException with generic message if expired', async () => {
      const pastDate = new Date();
      pastDate.setFullYear(2020);
      mockPrisma.coupon.findUnique.mockResolvedValue({
        ...validCoupon,
        expiresAt: pastDate,
      });
      await expect(
        service.validateCoupon('SAVE10', 'user1', PaymentType.LMS_COURSE, 1000),
      ).rejects.toThrow('This coupon code is not valid or has expired');
    });

    it('R3: throws BadRequestException with generic message if global usage limit reached', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue({
        ...validCoupon,
        usageLimit: 5,
        usedCount: 5,
      });
      await expect(
        service.validateCoupon('SAVE10', 'user1', PaymentType.LMS_COURSE, 1000),
      ).rejects.toThrow('This coupon code is not valid or has expired');
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
      coupon: { findUnique: jest.fn(), updateMany: jest.fn() },
      couponUse: { create: jest.fn() },
    };

    const validTxCoupon = {
      uuid: 'c1',
      isActive: true,
      expiresAt: null,
      usageLimit: null,
      usedCount: 0,
      perUserLimit: 1,
      applicableTo: CouponScope.ALL,
      type: CouponType.FLAT,
      value: 50,
    };

    beforeEach(() => {
      mockTx.coupon.findUnique.mockResolvedValue(validTxCoupon);
      mockTx.couponUse.create.mockResolvedValue({});
      mockTx.coupon.updateMany.mockResolvedValue({ count: 1 });
    });

    it('C1/C2: works correctly inside a transaction (no usage limit)', async () => {
      const result = await service.validateCouponInTx(
        'TXCODE',
        'u1',
        PaymentType.LMS_COURSE,
        100,
        mockTx,
      );
      expect(result.discountAmount).toBe(50);
      expect(mockTx.couponUse.create).toHaveBeenCalledWith({
        data: { couponUuid: 'c1', userUuid: 'u1' },
      });
      expect(mockTx.coupon.updateMany).not.toHaveBeenCalled();
    });

    it('C1: atomically increments usedCount when usageLimit is set', async () => {
      mockTx.coupon.findUnique.mockResolvedValue({
        ...validTxCoupon,
        usageLimit: 10,
        usedCount: 5,
      });

      const result = await service.validateCouponInTx(
        'TXCODE',
        'u1',
        PaymentType.LMS_COURSE,
        100,
        mockTx,
      );
      expect(result.discountAmount).toBe(50);
      expect(mockTx.coupon.updateMany).toHaveBeenCalledWith({
        where: { uuid: 'c1', usedCount: { lt: 10 } },
        data: { usedCount: { increment: 1 } },
      });
    });

    it('C1: throws when updateMany returns count=0 (limit reached concurrently)', async () => {
      mockTx.coupon.findUnique.mockResolvedValue({
        ...validTxCoupon,
        usageLimit: 10,
        usedCount: 9,
      });
      mockTx.coupon.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.validateCouponInTx('TXCODE', 'u1', PaymentType.LMS_COURSE, 100, mockTx),
      ).rejects.toThrow('This coupon code is not valid or has expired');
    });

    it('C2: throws when couponUse.create throws (user already used coupon)', async () => {
      mockTx.couponUse.create.mockRejectedValue(new Error('Unique constraint'));

      await expect(
        service.validateCouponInTx('TXCODE', 'u1', PaymentType.LMS_COURSE, 100, mockTx),
      ).rejects.toThrow('You have already used this coupon');
    });

    it('R3: throws generic message when coupon not found in tx', async () => {
      mockTx.coupon.findUnique.mockResolvedValue(null);

      await expect(
        service.validateCouponInTx('MISSING', 'u1', PaymentType.LMS_COURSE, 100, mockTx),
      ).rejects.toThrow('This coupon code is not valid or has expired');
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
