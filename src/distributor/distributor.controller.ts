import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
  Param,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { DistributorSubscriptionService } from './distributor-subscription.service.js';
import { DistributorService } from './distributor.service.js';
import { DistributorPlanService } from './distributor-plan.service.js';
import { SubscribeDto } from './dto/subscribe.dto.js';
import { UtmQueryDto } from './dto/utm-query.dto.js';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

@Controller({ path: 'distributor', version: '1' })
export class DistributorController {
  constructor(
    private readonly subscriptionService: DistributorSubscriptionService,
    private readonly distributorService: DistributorService,
    private readonly planService: DistributorPlanService,
  ) {}

  /**
   * POST /api/v1/distributor/subscribe
   * Auth: any authenticated user
   */
  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  subscribe(@Req() req: Request, @Body() dto: SubscribeDto) {
    const user = req.user as JwtPayload;
    return this.subscriptionService.subscribe(user.sub, dto);
  }

  /**
   * GET /api/v1/distributor/subscription
   * Auth: DISTRIBUTOR
   */
  @Get('subscription')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DISTRIBUTOR')
  getMySubscription(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.subscriptionService.getMySubscription(user.sub);
  }

  /**
   * GET /api/v1/distributor/join-link
   * Auth: DISTRIBUTOR
   */
  @Get('join-link')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DISTRIBUTOR')
  getJoinLink(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.distributorService.getJoinLink(user.sub);
  }

  /**
   * GET /api/v1/distributor/dashboard
   * Auth: DISTRIBUTOR
   */
  @Get('dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DISTRIBUTOR')
  getDashboard(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.distributorService.getDashboard(user.sub);
  }

  /**
   * GET /api/v1/distributor/analytics/utm
   * Auth: DISTRIBUTOR
   */
  @Get('analytics/utm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DISTRIBUTOR')
  getUtmAnalytics(@Req() req: Request, @Query() query: UtmQueryDto) {
    const user = req.user as JwtPayload;
    return this.distributorService.getUtmAnalytics(user.sub, query);
  }

  /**
   * GET /api/v1/join/:code
   * Public — no auth required
   */
  @Get('/join/:code')
  resolveJoinCode(@Param('code') code: string) {
    return this.distributorService.resolveJoinCode(code);
  }

  /**
   * GET /api/v1/distributor/plans
   * Auth: any authenticated user
   */
  @Get('plans')
  @UseGuards(JwtAuthGuard)
  getActivePlans() {
    return this.planService.getActivePlans();
  }
}
