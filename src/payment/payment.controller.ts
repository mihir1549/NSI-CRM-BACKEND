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
import { Request } from 'express';
import { PaymentService } from './payment.service.js';
import { CreateOrderDto } from './payment.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OnboardingGuard } from '../auth/guards/onboarding.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

@Controller('payments')
@UseGuards(JwtAuthGuard, OnboardingGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  // POST /api/v1/payments/create-order
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
  @Get('status')
  @HttpCode(HttpStatus.OK)
  async getStatus(@CurrentUser() user: JwtPayload) {
    return this.paymentService.getStatus(user.sub);
  }
}
