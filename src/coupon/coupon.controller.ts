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
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Request } from 'express';
import { CouponService, type CouponStatusFilter } from './coupon.service.js';
import { CreateCouponDto, UpdateCouponDto, ValidateCouponDto } from './coupon.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { OnboardingGuard } from '../auth/guards/onboarding.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ErrorResponse } from '../common/dto/responses/error.response.js';
import {
  CouponItem,
  CouponDetailResponse,
  CouponUpdateResponse,
  CouponValidationResponse,
  CouponMessageResponse,
} from './dto/responses/coupon.responses.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';
import { PaymentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

// ─── Admin coupon routes ─────────────────────────────────────────────────────

@ApiTags('Payment')
@ApiBearerAuth('access-token')
@Controller('admin/coupons')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class CouponAdminController {
  constructor(private readonly couponService: CouponService) {}

  @ApiOperation({ summary: 'Admin: create a coupon' })
  @ApiResponse({ status: 201, description: 'Coupon created', type: CouponItem })
  @ApiResponse({ status: 409, description: 'Coupon code already exists', type: ErrorResponse })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createCoupon(@Body() dto: CreateCouponDto) {
    return this.couponService.createCoupon(dto);
  }

  @ApiOperation({ summary: 'Admin: list all coupons' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status' })
  @ApiResponse({ status: 200, description: 'Coupons list', type: [CouponItem] })
  @Get()
  @HttpCode(HttpStatus.OK)
  async listCoupons(@Query('status') status?: CouponStatusFilter) {
    return this.couponService.listCoupons(status);
  }

  @ApiOperation({ summary: 'Admin: get coupon detail' })
  @ApiParam({ name: 'uuid', description: 'Coupon UUID' })
  @ApiResponse({ status: 200, description: 'Coupon detail', type: CouponDetailResponse })
  @ApiResponse({ status: 404, description: 'Coupon not found', type: ErrorResponse })
  @Get(':uuid')
  @HttpCode(HttpStatus.OK)
  async getCoupon(@Param('uuid') uuid: string) {
    return this.couponService.getCouponDetail(uuid);
  }

  @ApiOperation({ summary: 'Admin: get coupon data for editing' })
  @ApiParam({ name: 'uuid', description: 'Coupon UUID' })
  @ApiResponse({ status: 200, description: 'Coupon edit data', type: CouponUpdateResponse })
  @ApiResponse({ status: 404, description: 'Coupon not found', type: ErrorResponse })
  @Get(':uuid/edit')
  @HttpCode(HttpStatus.OK)
  async getCouponForUpdate(@Param('uuid') uuid: string) {
    return this.couponService.getCouponForUpdate(uuid);
  }

  @ApiOperation({ summary: 'Admin: update a coupon' })
  @ApiParam({ name: 'uuid', description: 'Coupon UUID' })
  @ApiResponse({ status: 200, description: 'Coupon updated', type: CouponItem })
  @ApiResponse({ status: 400, description: 'Cannot reactivate expired coupon', type: ErrorResponse })
  @ApiResponse({ status: 404, description: 'Coupon not found', type: ErrorResponse })
  @Patch(':uuid')
  @HttpCode(HttpStatus.OK)
  async updateCoupon(@Param('uuid') uuid: string, @Body() dto: UpdateCouponDto) {
    return this.couponService.updateCoupon(uuid, dto);
  }

  @ApiOperation({ summary: 'Admin: delete a coupon' })
  @ApiParam({ name: 'uuid', description: 'Coupon UUID' })
  @ApiResponse({ status: 200, description: 'Coupon deleted (soft or hard depending on usage)', type: CouponMessageResponse })
  @ApiResponse({ status: 404, description: 'Coupon not found', type: ErrorResponse })
  @Delete(':uuid')
  @HttpCode(HttpStatus.OK)
  async deleteCoupon(@Param('uuid') uuid: string) {
    return this.couponService.deleteCoupon(uuid);
  }
}

// ─── User coupon validate (preview, does NOT consume) ───────────────────────

@ApiTags('Payment')
@ApiBearerAuth('access-token')
@Controller('coupons')
@UseGuards(JwtAuthGuard, OnboardingGuard)
export class CouponController {
  constructor(
    private readonly couponService: CouponService,
    private readonly prisma: PrismaService,
  ) {}

  @ApiOperation({ summary: 'Validate a coupon code (preview, does not consume)' })
  @ApiResponse({ status: 200, description: 'Coupon valid, returns discount details', type: CouponValidationResponse })
  @ApiResponse({ status: 400, description: 'Coupon invalid or not applicable', type: ErrorResponse })
  @ApiResponse({ status: 404, description: 'Coupon not found', type: ErrorResponse })
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
