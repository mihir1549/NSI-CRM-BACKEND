import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CouponType, CouponScope, PaymentType, Coupon } from '@prisma/client';
import type { CreateCouponDto, UpdateCouponDto } from './coupon.dto.js';

export type CouponStatusFilter = 'active' | 'inactive' | 'expired' | 'all';

export interface CouponValidationResult {
  coupon: Coupon;
  discountAmount: number;
  finalAmount: number;
}

// Map PaymentType to the matching CouponScope
const PAYMENT_TYPE_TO_SCOPE: Record<PaymentType, CouponScope> = {
  COMMITMENT_FEE: CouponScope.COMMITMENT_FEE,
  LMS_COURSE: CouponScope.LMS_COURSE,
  DISTRIBUTOR_SUB: CouponScope.DISTRIBUTOR_SUB,
};

@Injectable()
export class CouponService {
  private readonly logger = new Logger(CouponService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── VALIDATE COUPON (public preview — does NOT consume coupon) ─────
  // FIX 6: Ordered validation with specific error messages

  async validateCoupon(
    code: string,
    userUuid: string,
    paymentType: PaymentType,
    originalAmount: number,
  ): Promise<CouponValidationResult> {
    // FIX 1: Always uppercase + trim before lookup
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: code.toUpperCase().trim() },
    });

    // FIX 6 — Check 1: Coupon not found
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    // FIX 6 — Check 2: Deactivated
    if (!coupon.isActive) {
      throw new BadRequestException('This coupon is no longer active');
    }

    // FIX 6 — Check 3: Expired
    if (coupon.expiresAt && coupon.expiresAt <= new Date()) {
      throw new BadRequestException('This coupon has expired');
    }

    // FIX 6 — Check 4: Global usage limit reached
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException('This coupon has reached its usage limit');
    }

    // FIX 6 — Check 5: Per-user limit reached
    const usageCount = await this.prisma.couponUse.count({
      where: { couponUuid: coupon.uuid, userUuid },
    });

    if (usageCount >= coupon.perUserLimit) {
      throw new BadRequestException('You have already used this coupon');
    }

    // FIX 6 — Check 6: Scope mismatch
    const requiredScope = PAYMENT_TYPE_TO_SCOPE[paymentType];
    if (coupon.applicableTo !== CouponScope.ALL && coupon.applicableTo !== requiredScope) {
      throw new BadRequestException('This coupon is not valid for this payment type');
    }

    return this.calculateDiscount(coupon, originalAmount);
  }

  /**
   * Validate coupon inside an existing Prisma transaction.
   * Used by PaymentService to prevent race conditions.
   */
  async validateCouponInTx(
    code: string,
    userUuid: string,
    paymentType: PaymentType,
    originalAmount: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
  ): Promise<CouponValidationResult> {
    const coupon = await tx.coupon.findUnique({
      where: { code: code.toUpperCase().trim() },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    if (!coupon.isActive) {
      throw new BadRequestException('This coupon is no longer active');
    }

    if (coupon.expiresAt && coupon.expiresAt <= new Date()) {
      throw new BadRequestException('This coupon has expired');
    }

    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException('This coupon has reached its usage limit');
    }

    const usageCount = await tx.couponUse.count({
      where: { couponUuid: coupon.uuid, userUuid },
    });

    if (usageCount >= coupon.perUserLimit) {
      throw new BadRequestException('You have already used this coupon');
    }

    const requiredScope = PAYMENT_TYPE_TO_SCOPE[paymentType];
    if (coupon.applicableTo !== CouponScope.ALL && coupon.applicableTo !== requiredScope) {
      throw new BadRequestException('This coupon is not valid for this payment type');
    }

    return this.calculateDiscount(coupon, originalAmount);
  }

  // ─── ADMIN: CREATE COUPON ────────────────────────────────
  // FIX 1: Always uppercase + trim before saving

  async createCoupon(dto: CreateCouponDto) {
    const code = dto.code.toUpperCase().trim();
    this.assertExpiryIsInFuture(dto.expiresAt);

    const existing = await this.prisma.coupon.findUnique({ where: { code } });
    if (existing) {
      throw new ConflictException('Coupon code already exists');
    }

    const coupon = await this.prisma.coupon.create({
      data: {
        code,
        type: dto.type,
        value: dto.value,
        applicableTo: dto.applicableTo,
        usageLimit: dto.usageLimit ?? null,
        perUserLimit: dto.perUserLimit ?? 1,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });

    return { ...coupon, status: this.computeCouponStatus(coupon) };
  }

  // ─── ADMIN: LIST COUPONS ─────────────────────────────────
  // FIX 2: Smart status filter with computed status field

  async listCoupons(statusFilter: CouponStatusFilter = 'active') {
    const now = new Date();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let where: any;

    switch (statusFilter) {
      case 'active':
        where = {
          isActive: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } },
          ],
        };
        break;
      case 'inactive':
        where = {
          isActive: false,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } },
          ],
        };
        break;
      case 'expired':
        where = {
          expiresAt: { not: null, lte: now },
        };
        break;
      case 'all':
        where = undefined;
        break;
      default:
        where = {
          isActive: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } },
          ],
        };
    }

    const coupons = await this.prisma.coupon.findMany({
      ...(where && { where }),
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { uses: true } } },
    });

    // FIX 5: Add computed status field to each coupon
    return coupons.map((coupon) => ({
      ...coupon,
      status: this.computeCouponStatus(coupon),
    }));
  }

  // ─── ADMIN: GET COUPON DETAIL ────────────────────────────
  // FIX 5: Add computed status field

  async getCouponDetail(uuid: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { uuid },
      include: {
        uses: {
          include: { user: { select: { uuid: true, fullName: true, email: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    return { ...coupon, status: this.computeCouponStatus(coupon) };
  }

  // ─── ADMIN: UPDATE COUPON ────────────────────────────────
  // FIX 4: Reactivation protection for expired coupons

  async updateCoupon(uuid: string, dto: UpdateCouponDto) {
    const coupon = await this.prisma.coupon.findUnique({ where: { uuid } });
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    if (dto.expiresAt !== undefined) {
      this.assertExpiryIsInFuture(dto.expiresAt);
    }

    // FIX 4: Block reactivation of expired coupons
    if (
      dto.isActive === true &&
      coupon.expiresAt !== null &&
      coupon.expiresAt <= new Date()
    ) {
      throw new BadRequestException(
        'Cannot reactivate an expired coupon. Please create a new coupon with a new expiry date.',
      );
    }

    const updated = await this.prisma.coupon.update({
      where: { uuid },
      data: {
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.expiresAt !== undefined && { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null }),
        ...(dto.usageLimit !== undefined && { usageLimit: dto.usageLimit }),
      },
    });

    return { ...updated, status: this.computeCouponStatus(updated) };
  }

  // ─── ADMIN: SMART DELETE COUPON ─────────────────────────
  // FIX 3: Soft delete if used, hard delete if never used

  async deleteCoupon(uuid: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { uuid } });
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    // If coupon has been used → soft delete only (preserve data for auditing)
    if (coupon.usedCount > 0) {
      await this.prisma.coupon.update({
        where: { uuid },
        data: { isActive: false },
      });
      return { message: 'Coupon deactivated. Cannot hard delete because it has been used.' };
    }

    // If coupon has never been used → hard delete
    await this.prisma.coupon.delete({ where: { uuid } });
    return { message: 'Coupon permanently deleted.' };
  }

  // ─── PRIVATE HELPERS ────────────────────────────────────

  // FIX 5: Computed status for frontend display
  private computeCouponStatus(coupon: Pick<Coupon, 'expiresAt' | 'isActive'>): 'ACTIVE' | 'INACTIVE' | 'EXPIRED' {
    if (coupon.expiresAt && coupon.expiresAt <= new Date()) {
      return 'EXPIRED';
    }
    if (!coupon.isActive) {
      return 'INACTIVE';
    }
    return 'ACTIVE';
  }

  private assertExpiryIsInFuture(expiresAt?: string) {
    if (!expiresAt) {
      return;
    }

    if (new Date(expiresAt) <= new Date()) {
      throw new BadRequestException('Expiry date must be in the future');
    }
  }

  private calculateDiscount(coupon: Coupon, originalAmount: number): CouponValidationResult {
    let discountAmount: number;

    switch (coupon.type) {
      case CouponType.FLAT:
        discountAmount = coupon.value;
        break;
      case CouponType.PERCENT:
        discountAmount = Math.floor((originalAmount * coupon.value) / 100);
        break;
      case CouponType.FREE:
        discountAmount = originalAmount;
        break;
      default:
        discountAmount = 0;
    }

    const finalAmount = Math.max(0, originalAmount - discountAmount);
    return { coupon, discountAmount, finalAmount };
  }
}
