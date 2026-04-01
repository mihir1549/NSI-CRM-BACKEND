import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { LeadsService } from './leads.service.js';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

/**
 * LeadsController — distributor-facing routes.
 * All routes require JWT + RolesGuard(DISTRIBUTOR).
 * Distributors can only read/update leads where assignedToUuid = their UUID.
 */
@Controller({ path: 'leads', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DISTRIBUTOR')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  /**
   * GET /api/v1/leads
   * Own leads only. Optional ?status= filter.
   */
  @Get()
  getMyLeads(@CurrentUser() user: JwtPayload, @Query('status') status?: string) {
    return this.leadsService.getDistributorLeads(user.sub, status);
  }

  /**
   * GET /api/v1/leads/followups/today
   * Today's followups for this distributor.
   * Must be declared BEFORE :uuid to avoid route collision.
   */
  @Get('followups/today')
  getTodayFollowups(@CurrentUser() user: JwtPayload) {
    return this.leadsService.getDistributorTodayFollowups(user.sub);
  }

  /**
   * GET /api/v1/leads/:uuid
   * Single lead detail with activities. 403 if not their lead.
   */
  @Get(':uuid')
  getLead(@CurrentUser() user: JwtPayload, @Param('uuid') leadUuid: string) {
    return this.leadsService.getDistributorLead(leadUuid, user.sub);
  }

  /**
   * PATCH /api/v1/leads/:uuid/status
   * Change status on own lead. 403 if not their lead.
   */
  @Patch(':uuid/status')
  updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param('uuid') leadUuid: string,
    @Body() dto: UpdateLeadStatusDto,
  ) {
    return this.leadsService.updateDistributorLeadStatus(leadUuid, user.sub, dto);
  }
}
