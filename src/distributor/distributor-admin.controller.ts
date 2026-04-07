import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { DistributorPlanService } from './distributor-plan.service.js';
import { DistributorSubscriptionService } from './distributor-subscription.service.js';
import { CreatePlanDto } from './dto/create-plan.dto.js';
import { SubscriptionQueryDto } from './dto/subscription-query.dto.js';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

@Controller({ path: 'admin', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class DistributorAdminController {
  constructor(
    private readonly planService: DistributorPlanService,
    private readonly subscriptionService: DistributorSubscriptionService,
  ) {}

  // ─── Plan Management ──────────────────────────────────────────────────────

  @Post('distributor-plans')
  createPlan(@Req() req: Request, @Body() dto: CreatePlanDto) {
    const user = req.user as JwtPayload;
    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip ?? '';
    return this.planService.createPlan(dto, user.sub, ip);
  }

  @Get('distributor-plans')
  listPlans() {
    return this.planService.listPlans();
  }

  @Patch('distributor-plans/:uuid/deactivate')
  deactivatePlan(@Req() req: Request, @Param('uuid') uuid: string) {
    const user = req.user as JwtPayload;
    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip ?? '';
    return this.planService.deactivatePlan(uuid, user.sub, ip);
  }

  // ─── Subscription Management ──────────────────────────────────────────────

  @Get('distributor-subscriptions')
  listSubscriptions(@Query() query: SubscriptionQueryDto) {
    return this.subscriptionService.listSubscriptions(query);
  }

  @Get('distributor-subscriptions/:uuid')
  getSubscription(@Param('uuid') uuid: string) {
    return this.subscriptionService.getSubscription(uuid);
  }

  @Post('distributor-subscriptions/:uuid/cancel')
  cancelSubscription(@Req() req: Request, @Param('uuid') uuid: string) {
    const user = req.user as JwtPayload;
    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip ?? '';
    return this.subscriptionService.cancelSubscription(uuid, user.sub, ip);
  }
}
