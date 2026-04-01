import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OnboardingGuard } from '../auth/guards/onboarding.guard.js';
import { FunnelService } from './funnel.service.js';
import { CompleteStepDto } from './dto/complete-step.dto.js';
import { VideoProgressDto } from './dto/video-progress.dto.js';
import { DecisionDto } from './dto/decision.dto.js';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

/**
 * FunnelController — all user-facing funnel endpoints.
 * All routes require JwtAuthGuard + OnboardingGuard.
 * Backend is source of truth for all state.
 */
@Controller({ path: 'funnel', version: '1' })
@UseGuards(JwtAuthGuard, OnboardingGuard)
export class FunnelController {
  constructor(private readonly funnelService: FunnelService) {}

  @Get('structure')
  getStructure() {
    return this.funnelService.getStructure();
  }

  @Get('progress')
  getProgress(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.funnelService.getProgress(user.sub);
  }

  @Get('step/:stepUuid')
  getStep(@Req() req: Request, @Param('stepUuid') stepUuid: string) {
    const user = req.user as JwtPayload;
    return this.funnelService.getStep(user.sub, stepUuid);
  }

  @Post('step/:stepUuid/complete')
  completeStep(
    @Req() req: Request,
    @Param('stepUuid') stepUuid: string,
    @Body() dto: CompleteStepDto,
  ) {
    const user = req.user as JwtPayload;
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? '';
    return this.funnelService.completeStep(user.sub, stepUuid, dto, ip);
  }

  @Post('step/:stepUuid/video-progress')
  saveVideoProgress(
    @Req() req: Request,
    @Param('stepUuid') stepUuid: string,
    @Body() dto: VideoProgressDto,
  ) {
    const user = req.user as JwtPayload;
    return this.funnelService.saveVideoProgress(user.sub, stepUuid, dto.watchedSeconds);
  }

  @Post('decision')
  recordDecision(@Req() req: Request, @Body() dto: DecisionDto) {
    const user = req.user as JwtPayload;
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? '';
    return this.funnelService.recordDecision(user.sub, dto, ip);
  }
}
