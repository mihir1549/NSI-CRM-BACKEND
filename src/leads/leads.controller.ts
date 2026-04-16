import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';

import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { LeadsService } from './leads.service.js';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto.js';
import {
  LeadListResponse,
  LeadDetailResponse,
  LeadItemResponse,
} from './dto/responses/leads.responses.js';
import { ErrorResponse } from '../common/dto/responses/error.response.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js'; /**
 * LeadsController — distributor-facing routes.
 * All routes require JWT + RolesGuard(DISTRIBUTOR).
 * Distributors can only read/update leads where assignedToUuid = their UUID.
 */
@ApiTags('Leads')
@ApiBearerAuth('access-token')
@Controller({ path: 'leads', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DISTRIBUTOR')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  /**
   * GET /api/v1/leads
   * Own leads only. Optional ?status=, ?search=, ?page=, ?limit=.
   */
  @ApiOperation({ summary: 'List own leads with optional filters' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by lead status',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by name or email',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Paginated leads list',
    type: LeadListResponse,
  })
  @Get()
  getMyLeads(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.leadsService.getDistributorLeads(
      user.sub,
      status,
      search,
      pageNum,
      limitNum,
    );
  }

  /**
   * GET /api/v1/leads/followups/today
   * Today's followups for this distributor.
   * Must be declared BEFORE :uuid to avoid route collision.
   */
  @ApiOperation({ summary: "Get today's follow-up leads" })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: "Today's followups (paginated)",
    type: LeadListResponse,
  })
  @Get('followups/today')
  getTodayFollowups(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.leadsService.getDistributorTodayFollowups(
      user.sub,
      pageNum,
      limitNum,
    );
  }

  /**
   * GET /api/v1/leads/:uuid/history
   * Status-change history for own lead only. 403 if not their lead.
   * Must be declared BEFORE :uuid to avoid route conflict.
   */
  @ApiOperation({ summary: 'Get lead status change history (own leads only)' })
  @ApiParam({ name: 'uuid', type: String })
  @ApiResponse({ status: 200, description: 'Lead status history' })
  @Get(':uuid/history')
  getLeadStatusHistory(
    @CurrentUser() user: JwtPayload,
    @Param('uuid', new ParseUUIDPipe()) uuid: string,
  ): Promise<any> {
    return this.leadsService.getLeadStatusHistory(uuid, user.sub, user.role);
  }

  /**
   * GET /api/v1/leads/:uuid
   * Single lead detail with activities. 403 if not their lead.
   */
  @ApiOperation({ summary: 'Get single lead detail' })
  @ApiParam({ name: 'uuid', description: 'Lead UUID' })
  @ApiResponse({
    status: 200,
    description: 'Lead detail',
    type: LeadDetailResponse,
  })
  @ApiResponse({
    status: 403,
    description: 'Not your lead',
    type: ErrorResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'Lead not found',
    type: ErrorResponse,
  })
  @Get(':uuid')
  getLead(@CurrentUser() user: JwtPayload, @Param('uuid') leadUuid: string) {
    return this.leadsService.getDistributorLead(leadUuid, user.sub);
  }

  /**
   * PATCH /api/v1/leads/:uuid/status
   * Change status on own lead. 403 if not their lead.
   */
  @ApiOperation({ summary: 'Update lead status' })
  @ApiParam({ name: 'uuid', description: 'Lead UUID' })
  @ApiResponse({
    status: 200,
    description: 'Status updated',
    type: LeadItemResponse,
  })
  @ApiResponse({ status: 400, description: 'Bad request', type: ErrorResponse })
  @ApiResponse({
    status: 403,
    description: 'Not your lead',
    type: ErrorResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'Lead not found',
    type: ErrorResponse,
  })
  @Patch(':uuid/status')
  updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param('uuid') leadUuid: string,
    @Body() dto: UpdateLeadStatusDto,
  ) {
    return this.leadsService.updateDistributorLeadStatus(
      leadUuid,
      user.sub,
      dto,
    );
  }
}
