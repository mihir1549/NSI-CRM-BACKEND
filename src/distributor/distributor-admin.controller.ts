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
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { DistributorPlanService } from './distributor-plan.service.js';
import { DistributorSubscriptionService } from './distributor-subscription.service.js';
import { CreatePlanDto, UpdatePlanDto } from './dto/create-plan.dto.js';
import { SubscriptionQueryDto } from './dto/subscription-query.dto.js';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

@ApiTags('Distributor - Admin')
@ApiBearerAuth('access-token')
@Controller({ path: 'admin', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class DistributorAdminController {
  constructor(
    private readonly planService: DistributorPlanService,
    private readonly subscriptionService: DistributorSubscriptionService,
  ) {}

  // ─── Plan Management ──────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Create a distributor plan' })
  @ApiResponse({ status: 201, description: 'Plan created' })
  @Post('distributor-plans')
  createPlan(@Req() req: Request, @Body() dto: CreatePlanDto) {
    const user = req.user as JwtPayload;
    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip ?? '';
    return this.planService.createPlan(dto, user.sub, ip);
  }

  @ApiOperation({ summary: 'List all distributor plans' })
  @ApiResponse({ status: 200, description: 'Plans list' })
  @Get('distributor-plans')
  listPlans() {
    return this.planService.listPlans();
  }

  @ApiOperation({ summary: 'Get plan data for editing' })
  @ApiParam({ name: 'uuid', description: 'Plan UUID' })
  @ApiResponse({ status: 200, description: 'Plan edit data' })
  @Get('distributor-plans/:uuid/edit')
  getPlanForUpdate(@Param('uuid') uuid: string) {
    return this.planService.getPlanForUpdate(uuid);
  }

  /**
   * PATCH /api/v1/admin/distributor-plans/:uuid
   * Edit content fields (name, tagline, features, etc.) — amount is immutable.
   * Must be declared BEFORE /distributor-plans/:uuid/deactivate
   */
  @ApiOperation({ summary: 'Update plan content fields' })
  @ApiParam({ name: 'uuid', description: 'Plan UUID' })
  @ApiResponse({ status: 200, description: 'Plan updated' })
  @Patch('distributor-plans/:uuid')
  updatePlan(@Param('uuid') uuid: string, @Body() dto: UpdatePlanDto) {
    return this.planService.updatePlan(uuid, dto);
  }

  @ApiOperation({ summary: 'Deactivate a distributor plan' })
  @ApiParam({ name: 'uuid', description: 'Plan UUID' })
  @ApiResponse({ status: 200, description: 'Plan deactivated' })
  @Patch('distributor-plans/:uuid/deactivate')
  deactivatePlan(@Req() req: Request, @Param('uuid') uuid: string) {
    const user = req.user as JwtPayload;
    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip ?? '';
    return this.planService.deactivatePlan(uuid, user.sub, ip);
  }

  // ─── Subscription Management ──────────────────────────────────────────────

  @ApiOperation({ summary: 'List all distributor subscriptions' })
  @ApiResponse({ status: 200, description: 'Paginated subscriptions list' })
  @Get('distributor-subscriptions')
  listSubscriptions(@Query() query: SubscriptionQueryDto) {
    return this.subscriptionService.listSubscriptions(query);
  }

  @ApiOperation({ summary: 'Get a subscription detail' })
  @ApiParam({ name: 'uuid', description: 'Subscription UUID' })
  @ApiResponse({ status: 200, description: 'Subscription detail' })
  @Get('distributor-subscriptions/:uuid')
  getSubscription(@Param('uuid') uuid: string) {
    return this.subscriptionService.getSubscription(uuid);
  }

  @ApiOperation({ summary: 'Admin cancel a distributor subscription' })
  @ApiParam({ name: 'uuid', description: 'Subscription UUID' })
  @ApiResponse({ status: 201, description: 'Subscription cancelled' })
  @Post('distributor-subscriptions/:uuid/cancel')
  cancelSubscription(@Req() req: Request, @Param('uuid') uuid: string) {
    const user = req.user as JwtPayload;
    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip ?? '';
    return this.subscriptionService.cancelSubscription(uuid, user.sub, ip);
  }
}
