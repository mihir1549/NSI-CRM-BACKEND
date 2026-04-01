import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { PhoneService } from './phone.service.js';
import { SendOtpDto, VerifyOtpDto } from './phone.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OnboardingGuard } from '../auth/guards/onboarding.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

@Controller('phone')
@UseGuards(JwtAuthGuard, OnboardingGuard)
export class PhoneController {
  constructor(private readonly phoneService: PhoneService) {}

  // POST /api/v1/phone/send-otp
  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  async sendOtp(
    @Body() dto: SendOtpDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    return this.phoneService.sendOtp(user.sub, dto.phone, dto.channel, ipAddress);
  }

  // POST /api/v1/phone/verify-otp
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    return this.phoneService.verifyOtp(user.sub, dto.phone, dto.code, dto.channel, ipAddress);
  }
}
