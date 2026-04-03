import {
  Controller,
  Get,
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
import { LeadsService } from './leads.service.js';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto.js';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

/**
 * LeadsAdminController — super-admin-facing routes.
 * All routes require JWT + RolesGuard(SUPER_ADMIN).
 * Admins can read and update all leads.
 */
@Controller({ path: 'admin/leads', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class LeadsAdminController {
  constructor(private readonly leadsService: LeadsService) {}

  /**
   * GET /api/v1/admin/leads
   * All leads. Optional ?status=, ?search=, ?page=, ?limit=.
   */
  @Get()
  getAllLeads(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.leadsService.getAllLeads(status, search, pageNum, limitNum);
  }

  /**
   * GET /api/v1/admin/leads/followups/today
   * Today's followups across all leads.
   * Must be declared BEFORE :uuid to avoid route collision.
   */
  @Get('followups/today')
  getTodayFollowups() {
    return this.leadsService.getAdminTodayFollowups();
  }

  /**
   * GET /api/v1/admin/leads/distributor/:distributorUuid
   * All leads assigned to a specific distributor.
   * Must be declared BEFORE :uuid to avoid route collision.
   */
  @Get('distributor/:distributorUuid')
  getLeadsForDistributor(@Param('distributorUuid') distributorUuid: string) {
    return this.leadsService.getLeadsForDistributor(distributorUuid);
  }

  /**
   * GET /api/v1/admin/leads/:uuid
   * Single lead detail + full activity log + nurture enrollment.
   */
  @Get(':uuid')
  getLead(@Param('uuid') leadUuid: string) {
    return this.leadsService.getAdminLead(leadUuid);
  }

  /**
   * PATCH /api/v1/admin/leads/:uuid/status
   * Change status on any lead.
   */
  @Patch(':uuid/status')
  updateStatus(
    @Req() req: Request,
    @Param('uuid') leadUuid: string,
    @Body() dto: UpdateLeadStatusDto,
  ) {
    const user = req.user as JwtPayload;
    return this.leadsService.updateAdminLeadStatus(leadUuid, user.sub, dto);
  }
}
