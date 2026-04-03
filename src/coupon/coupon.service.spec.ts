import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CouponScope, CouponType } from '@prisma/client';
import { CouponService } from './coupon.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  coupon: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
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
  });

  describe('createCoupon', () => {
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
      ).rejects.toThrow(new BadRequestException('Expiry date must be in the future'));

      expect(mockPrisma.coupon.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.coupon.create).not.toHaveBeenCalled();
    });
  });

  describe('updateCoupon', () => {
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
      ).rejects.toThrow(new BadRequestException('Expiry date must be in the future'));

      expect(mockPrisma.coupon.update).not.toHaveBeenCalled();
    });
  });
});
