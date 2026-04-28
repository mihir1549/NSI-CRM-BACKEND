import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { PhoneService } from './phone.service.js';
import { SendOtpDto, VerifyPhoneOtpDto } from './phone.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OnboardingGuard } from '../auth/guards/onboarding.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import {
  PhoneMessageResponse,
  PhoneVerifyResponse,
} from './dto/responses/phone.responses.js';
import { ErrorResponse } from '../common/dto/responses/error.response.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

@ApiTags('Auth')
@ApiBearerAuth('access-token')
@Controller('phone')
@UseGuards(JwtAuthGuard, OnboardingGuard)
export class PhoneController {
  constructor(private readonly phoneService: PhoneService) {}

  // POST /api/v1/phone/send-otp
  @ApiOperation({ summary: 'Send phone OTP (SMS or WhatsApp)' })
  @ApiResponse({
    status: 200,
    description: 'OTP sent',
    type: PhoneMessageResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid phone format',
    type: ErrorResponse,
  })
  @ApiResponse({
    status: 409,
    description: 'Phone already registered',
    type: ErrorResponse,
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests',
    type: ErrorResponse,
  })
  @Throttle({ strict: { limit: 50, ttl: 3600000 } }) // 50 per hour (relaxed for testing)
  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  async sendOtp(
    @Body() dto: SendOtpDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    return this.phoneService.sendOtp(
      user.sub,
      dto.phone,
      dto.channel,
      ipAddress,
    );
  }

  // POST /api/v1/phone/verify-otp
  @ApiOperation({ summary: 'Verify phone OTP' })
  @ApiResponse({
    status: 200,
    description: 'Phone verified',
    type: PhoneVerifyResponse,
  })
  @ApiResponse({ status: 400, description: 'Invalid OTP', type: ErrorResponse })
  @ApiResponse({
    status: 429,
    description: 'Too many wrong attempts lockout',
    type: ErrorResponse,
  })
  @Throttle({ strict: { limit: 10, ttl: 900000 } }) // 10 per 15 min
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body() dto: VerifyPhoneOtpDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    return this.phoneService.verifyOtp(
      user.sub,
      dto.phone,
      dto.code,
      dto.channel,
      ipAddress,
    );
  }
}
