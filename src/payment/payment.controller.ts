import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { PaymentService } from './payment.service.js';
import { CreateOrderDto } from './payment.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OnboardingGuard } from '../auth/guards/onboarding.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { PaymentOrderResponse, PaymentStatusResponse } from './dto/responses/payment.responses.js';
import { ErrorResponse } from '../common/dto/responses/error.response.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

@ApiTags('Payment')
@ApiBearerAuth('access-token')
@Controller('payments')
@UseGuards(JwtAuthGuard, OnboardingGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  // POST /api/v1/payments/create-order
  @ApiOperation({ summary: 'Create a Razorpay payment order' })
  @ApiResponse({ status: 201, description: 'Order created with Razorpay order ID or free access', type: PaymentOrderResponse })
  @ApiResponse({ status: 400, description: 'Payment gate not configured', type: ErrorResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponse })
  @ApiResponse({ status: 403, description: 'Phone verification required / Need to reach step', type: ErrorResponse })
  @ApiResponse({ status: 409, description: 'Payment already completed', type: ErrorResponse })
  @Post('create-order')
  @HttpCode(HttpStatus.CREATED)
  async createOrder(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    return this.paymentService.createOrder(user.sub, dto.couponCode, ipAddress);
  }

  // GET /api/v1/payments/status
  @ApiOperation({ summary: 'Get current user payment status' })
  @ApiResponse({ status: 200, description: 'Payment status', type: PaymentStatusResponse })
  @Get('status')
  @HttpCode(HttpStatus.OK)
  async getStatus(@CurrentUser() user: JwtPayload) {
    return this.paymentService.getStatus(user.sub);
  }
}
