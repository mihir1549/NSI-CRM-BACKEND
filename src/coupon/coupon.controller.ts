import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { CouponService, type CouponStatusFilter } from './coupon.service.js';
import { CreateCouponDto, UpdateCouponDto, ValidateCouponDto } from './coupon.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { OnboardingGuard } from '../auth/guards/onboarding.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';
import { PaymentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

// ─── Admin coupon routes ─────────────────────────────────────────────────────

@Controller('admin/coupons')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class CouponAdminController {
  constructor(private readonly couponService: CouponService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createCoupon(@Body() dto: CreateCouponDto) {
    return this.couponService.createCoupon(dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async listCoupons(@Query('status') status?: CouponStatusFilter) {
    return this.couponService.listCoupons(status);
  }

  @Get(':uuid')
  @HttpCode(HttpStatus.OK)
  async getCoupon(@Param('uuid') uuid: string) {
    return this.couponService.getCouponDetail(uuid);
  }

  @Patch(':uuid')
  @HttpCode(HttpStatus.OK)
  async updateCoupon(@Param('uuid') uuid: string, @Body() dto: UpdateCouponDto) {
    return this.couponService.updateCoupon(uuid, dto);
  }

  @Delete(':uuid')
  @HttpCode(HttpStatus.OK)
  async deleteCoupon(@Param('uuid') uuid: string) {
    return this.couponService.deleteCoupon(uuid);
  }
}

// ─── User coupon validate (preview, does NOT consume) ───────────────────────

@Controller('coupons')
@UseGuards(JwtAuthGuard, OnboardingGuard)
export class CouponController {
  constructor(
    private readonly couponService: CouponService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  async validateCoupon(
    @Body() dto: ValidateCouponDto,
    @CurrentUser() user: JwtPayload,
    @Req() _req: Request,
  ) {
    // Fetch the real payment amount from the user's current funnel step paymentGate
    let originalAmount = 0;
    const progress = await this.prisma.funnelProgress.findUnique({
      where: { userUuid: user.sub },
    });
    if (progress?.currentStepUuid) {
      const step = await this.prisma.funnelStep.findUnique({
        where: { uuid: progress.currentStepUuid },
        include: { paymentGate: true },
      });
      if (step?.paymentGate?.amount) {
        originalAmount = Number(step.paymentGate.amount);
      }
    }

    const result = await this.couponService.validateCoupon(
      dto.code,
      user.sub,
      dto.paymentType as PaymentType,
      originalAmount,
    );

    return {
      valid: true,
      couponCode: result.coupon.code,
      couponType: result.coupon.type,
      originalAmount,
      discountAmount: result.discountAmount,
      finalAmount: result.finalAmount,
      message: 'Coupon is valid',
    };
  }
}
