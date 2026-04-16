import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { AnalyticsAdminService } from './analytics-admin.service.js';
import { AnalyticsQueryDto } from './dto/analytics-query.dto.js';
import {
  AdminAnalyticsDashboardResponse,
  AdminAnalyticsFunnelResponse,
  AdminAnalyticsRevenueResponse,
  AdminAnalyticsLeadsResponse,
  AdminAnalyticsDistributorsResponse,
  AdminAnalyticsUtmResponse,
} from './dto/responses/admin.responses.js';

/**
 * AnalyticsAdminController — SUPER_ADMIN platform analytics routes.
 * All routes require JWT + RolesGuard(SUPER_ADMIN).
 * All routes accept ?from=&to= query params (ISO date strings).
 */
@ApiTags('Admin - Analytics')
@ApiBearerAuth('access-token')
@Controller({ path: 'admin/analytics', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AnalyticsAdminController {
  constructor(private readonly analyticsAdminService: AnalyticsAdminService) {}

  /**
   * GET /api/v1/admin/analytics/dashboard
   * Platform overview with user, lead, revenue, and funnel stats.
   */
  @ApiOperation({ summary: 'Admin: platform overview dashboard analytics' })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'Start date ISO string',
  })
  @ApiQuery({ name: 'to', required: false, description: 'End date ISO string' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard analytics',
    type: AdminAnalyticsDashboardResponse,
  })
  @Get('dashboard')
  getDashboard(@Query() query: AnalyticsQueryDto) {
    return this.analyticsAdminService.getDashboard(query);
  }

  /**
   * GET /api/v1/admin/analytics/funnel
   * Funnel stage breakdown with dropoff rates.
   */
  @ApiOperation({ summary: 'Admin: funnel stage breakdown with dropoff rates' })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'Start date ISO string',
  })
  @ApiQuery({ name: 'to', required: false, description: 'End date ISO string' })
  @ApiResponse({
    status: 200,
    description: 'Funnel analytics',
    type: AdminAnalyticsFunnelResponse,
  })
  @Get('funnel')
  getFunnelAnalytics(@Query() query: AnalyticsQueryDto) {
    return this.analyticsAdminService.getFunnelAnalytics(query);
  }

  /**
   * GET /api/v1/admin/analytics/revenue
   * Revenue analytics with chart data grouped by smart period.
   */
  @ApiOperation({ summary: 'Admin: revenue analytics with chart data' })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'Start date ISO string',
  })
  @ApiQuery({ name: 'to', required: false, description: 'End date ISO string' })
  @ApiResponse({
    status: 200,
    description: 'Revenue analytics',
    type: AdminAnalyticsRevenueResponse,
  })
  @Get('revenue')
  getRevenueAnalytics(@Query() query: AnalyticsQueryDto) {
    return this.analyticsAdminService.getRevenueAnalytics(query);
  }

  /**
   * GET /api/v1/admin/analytics/leads
   * Lead analytics by status, source, and chart over time.
   */
  @ApiOperation({ summary: 'Admin: lead analytics by status and source' })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'Start date ISO string',
  })
  @ApiQuery({ name: 'to', required: false, description: 'End date ISO string' })
  @ApiResponse({
    status: 200,
    description: 'Lead analytics',
    type: AdminAnalyticsLeadsResponse,
  })
  @Get('leads')
  getLeadsAnalytics(@Query() query: AnalyticsQueryDto) {
    return this.analyticsAdminService.getLeadsAnalytics(query);
  }

  /**
   * GET /api/v1/admin/analytics/distributors
   * Distributor performance analytics and rankings.
   */
  @ApiOperation({ summary: 'Admin: distributor performance analytics' })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'Start date ISO string',
  })
  @ApiQuery({ name: 'to', required: false, description: 'End date ISO string' })
  @ApiResponse({
    status: 200,
    description: 'Distributor analytics',
    type: AdminAnalyticsDistributorsResponse,
  })
  @Get('distributors')
  getDistributorsAnalytics(@Query() query: AnalyticsQueryDto) {
    return this.analyticsAdminService.getDistributorsAnalytics(query);
  }

  /**
   * GET /api/v1/admin/analytics/utm
   * UTM analytics with optional ?distributorUuid= filter.
   */
  @ApiOperation({
    summary: 'Admin: UTM analytics with optional distributor filter',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'Start date ISO string',
  })
  @ApiQuery({ name: 'to', required: false, description: 'End date ISO string' })
  @ApiQuery({
    name: 'distributorUuid',
    required: false,
    description: 'Filter by distributor UUID',
  })
  @ApiResponse({
    status: 200,
    description: 'UTM analytics',
    type: AdminAnalyticsUtmResponse,
  })
  @Get('utm')
  getUtmAnalytics(
    @Query() query: AnalyticsQueryDto,
    @Query('distributorUuid') distributorUuid?: string,
  ) {
    return this.analyticsAdminService.getUtmAnalytics({
      ...query,
      distributorUuid,
    });
  }
}
