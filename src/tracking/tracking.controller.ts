import { Controller, Post, Body, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { TrackingService } from './tracking.service.js';
import { CaptureUtmDto } from './dto/capture-utm.dto.js';
import { TrackingMessageResponse } from './dto/responses/tracking.responses.js';
import type { Request } from 'express';

/**
 * TrackingController — public endpoint for UTM capture.
 * Rate limited to 10 requests per IP per minute.
 * No JWT required.
 */
@ApiTags('Funnel')
@Controller({ path: 'tracking', version: '1' })
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @ApiOperation({ summary: 'Capture UTM parameters (public, rate-limited)' })
  @ApiResponse({
    status: 201,
    description: 'UTM data captured',
    type: TrackingMessageResponse,
  })
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('capture')
  async capture(@Body() dto: CaptureUtmDto, @Req() req: Request) {
    return this.trackingService.capture(dto, req);
  }
}
