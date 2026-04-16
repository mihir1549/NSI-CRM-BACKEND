import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
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
import { LeadsService } from './leads.service.js';
import { AdminUpdateLeadStatusDto } from './dto/admin-update-lead-status.dto.js';
import {
  LeadListResponse,
  LeadDetailResponse,
  LeadItemResponse,
} from './dto/responses/leads.responses.js';
import { ErrorResponse } from '../common/dto/responses/error.response.js';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

/**
 * LeadsAdminController — super-admin-facing routes.
 * All routes require JWT + RolesGuard(SUPER_ADMIN).
 * Admins can read and update all leads.
 */
@ApiTags('Leads')
@ApiBearerAuth('access-token')
@Controller({ path: 'admin/leads', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class LeadsAdminController {
  constructor(private readonly leadsService: LeadsService) {}

  /**
   * GET /api/v1/admin/leads
   * All leads. Optional ?status=, ?search=, ?page=, ?limit=.
   */
  @ApiOperation({ summary: 'Admin: list all leads with filters' })
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
  @ApiOperation({
    summary: "Admin: get today's follow-up leads across all distributors",
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: "Today's followups (paginated)",
    type: LeadListResponse,
  })
  @Get('followups/today')
  getTodayFollowups(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.leadsService.getAdminTodayFollowups(pageNum, limitNum);
  }

  /**
   * GET /api/v1/admin/leads/distributor/:distributorUuid
   * All leads referred by a specific distributor.
   * Supports ?status=, ?search=, ?page=, ?limit=.
   * Must be declared BEFORE :uuid to avoid route collision.
   */
  @ApiOperation({
    summary: 'Admin: get leads referred by a specific distributor',
  })
  @ApiParam({ name: 'distributorUuid', description: 'Distributor UUID' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Leads for distributor',
    type: LeadListResponse,
  })
  @Get('distributor/:distributorUuid')
  getLeadsForDistributor(
    @Param('distributorUuid') distributorUuid: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.leadsService.getLeadsForDistributor(
      distributorUuid,
      status,
      search,
      pageNum,
      limitNum,
    );
  }

  /**
   * GET /api/v1/admin/leads/:uuid/history
   * Full status-change history for any lead.
   * Must be declared BEFORE :uuid to avoid route conflict.
   */
  @ApiOperation({ summary: 'Get lead status change history' })
  @ApiParam({ name: 'uuid', type: String })
  @ApiResponse({ status: 200, description: 'Lead status history' })
  @Get(':uuid/history')
  getLeadStatusHistory(
    @Req() req: Request,
    @Param('uuid', new ParseUUIDPipe()) uuid: string,
  ): Promise<any> {
    const user = (req as any)
      .user as import('../auth/strategies/jwt.strategy.js').JwtPayload;
    return this.leadsService.getLeadStatusHistory(uuid, user.sub, user.role);
  }

  /**
   * GET /api/v1/admin/leads/:uuid
   * Single lead detail + full activity log + nurture enrollment.
   */
  @ApiOperation({ summary: 'Admin: get single lead detail' })
  @ApiParam({ name: 'uuid', description: 'Lead UUID' })
  @ApiResponse({
    status: 200,
    description: 'Lead detail',
    type: LeadDetailResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'Lead not found',
    type: ErrorResponse,
  })
  @Get(':uuid')
  getLead(@Param('uuid') leadUuid: string) {
    return this.leadsService.getAdminLead(leadUuid);
  }

  /**
   * PATCH /api/v1/admin/leads/:uuid/status
   * Change status on any lead.
   */
  @ApiOperation({ summary: 'Admin: update lead status' })
  @ApiParam({ name: 'uuid', description: 'Lead UUID' })
  @ApiResponse({
    status: 200,
    description: 'Status updated',
    type: LeadItemResponse,
  })
  @ApiResponse({ status: 400, description: 'Bad request', type: ErrorResponse })
  @ApiResponse({ status: 403, description: 'Forbidden', type: ErrorResponse })
  @ApiResponse({
    status: 404,
    description: 'Lead not found',
    type: ErrorResponse,
  })
  @Patch(':uuid/status')
  updateStatus(
    @Req() req: Request,
    @Param('uuid') leadUuid: string,
    @Body() dto: AdminUpdateLeadStatusDto,
  ) {
    const user = req.user as JwtPayload;
    return this.leadsService.updateAdminLeadStatus(leadUuid, user.sub, dto);
  }
}
