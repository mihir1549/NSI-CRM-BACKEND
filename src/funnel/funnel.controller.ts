import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OnboardingGuard } from '../auth/guards/onboarding.guard.js';
import { FunnelService } from './funnel.service.js';
import { CompleteStepDto } from './dto/complete-step.dto.js';
import { VideoProgressDto } from './dto/video-progress.dto.js';
import { DecisionDto } from './dto/decision.dto.js';
import {
  FunnelStructureResponse,
  FunnelProgressResponse,
  FunnelStepResponse,
  FunnelActionResponse,
} from './dto/responses/funnel.responses.js';
import { ErrorResponse } from '../common/dto/responses/error.response.js';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

/**
 * FunnelController — all user-facing funnel endpoints.
 * All routes require JwtAuthGuard + OnboardingGuard.
 * Backend is source of truth for all state.
 */
@ApiTags('Funnel')
@ApiBearerAuth('access-token')
@Controller({ path: 'funnel', version: '1' })
@UseGuards(JwtAuthGuard, OnboardingGuard)
export class FunnelController {
  constructor(private readonly funnelService: FunnelService) {}

  @ApiOperation({ summary: 'Get funnel structure (all sections and steps)' })
  @ApiResponse({ status: 200, description: 'Funnel structure', type: FunnelStructureResponse })
  @Get('structure')
  getStructure() {
    return this.funnelService.getStructure();
  }

  @ApiOperation({ summary: 'Get current user funnel progress' })
  @ApiResponse({ status: 200, description: 'User funnel progress', type: FunnelProgressResponse })
  @Get('progress')
  getProgress(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.funnelService.getProgress(user.sub);
  }

  @ApiOperation({ summary: 'Get a single funnel step content' })
  @ApiParam({ name: 'stepUuid', description: 'Funnel step UUID' })
  @ApiResponse({ status: 200, description: 'Step content', type: FunnelStepResponse })
  @ApiResponse({ status: 400, description: 'Must complete previous steps', type: ErrorResponse })
  @ApiResponse({ status: 404, description: 'Step not found', type: ErrorResponse })
  @Get('step/:stepUuid')
  getStep(@Req() req: Request, @Param('stepUuid') stepUuid: string) {
    const user = req.user as JwtPayload;
    return this.funnelService.getStep(user.sub, stepUuid);
  }

  @ApiOperation({ summary: 'Mark a funnel step as complete' })
  @ApiParam({ name: 'stepUuid', description: 'Funnel step UUID' })
  @ApiResponse({ status: 201, description: 'Step completed', type: FunnelActionResponse })
  @ApiResponse({ status: 400, description: 'Validation or sequential error', type: ErrorResponse })
  @ApiResponse({ status: 404, description: 'Step not found', type: ErrorResponse })
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

  @ApiOperation({ summary: 'Save video watch progress for a funnel step' })
  @ApiParam({ name: 'stepUuid', description: 'Funnel step UUID' })
  @ApiResponse({ status: 201, description: 'Progress saved', type: FunnelActionResponse })
  @Post('step/:stepUuid/video-progress')
  saveVideoProgress(
    @Req() req: Request,
    @Param('stepUuid') stepUuid: string,
    @Body() dto: VideoProgressDto,
  ) {
    const user = req.user as JwtPayload;
    return this.funnelService.saveVideoProgress(user.sub, stepUuid, dto.watchedSeconds);
  }

  @ApiOperation({ summary: 'Record user decision (join/skip)' })
  @ApiResponse({ status: 201, description: 'Decision recorded', type: FunnelActionResponse })
  @ApiResponse({ status: 400, description: 'Invalid decision', type: ErrorResponse })
  @Post('decision')
  recordDecision(@Req() req: Request, @Body() dto: DecisionDto) {
    const user = req.user as JwtPayload;
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? '';
    return this.funnelService.recordDecision(user.sub, dto, ip);
  }
}
