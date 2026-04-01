import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { TrackingService } from './tracking.service.js';
import { CaptureUtmDto } from './dto/capture-utm.dto.js';
import type { Request } from 'express';

/**
 * TrackingController — public endpoint for UTM capture.
 * Rate limited to 10 requests per IP per minute.
 * No JWT required.
 */
@Controller({ path: 'tracking', version: '1' })
@UseGuards(ThrottlerGuard)
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Post('capture')
  async capture(@Body() dto: CaptureUtmDto, @Req() req: Request) {
    return this.trackingService.capture(dto, req);
  }
}
