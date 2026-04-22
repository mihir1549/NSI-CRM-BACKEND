import { Controller, Post, Body, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { TrackingService } from './tracking.service.js';
import { CaptureUtmDto } from './dto/capture-utm.dto.js';
import { TrackingMessageResponse } from './dto/responses/tracking.responses.js';
import type { Request } from 'express';

/**
 * TrackingController — public endpoint for UTM capture.
 * No JWT required. Throttling is skipped because tracking beacons
 * fire on legitimate page navigations and should never 429.
 */
@ApiTags('Funnel')
@Controller({ path: 'tracking', version: '1' })
@SkipThrottle()
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @ApiOperation({ summary: 'Capture UTM parameters (public)' })
  @ApiResponse({
    status: 201,
    description: 'UTM data captured',
    type: TrackingMessageResponse,
  })
  @Post('capture')
  async capture(@Body() dto: CaptureUtmDto, @Req() req: Request) {
    return this.trackingService.capture(dto, req);
  }
}
