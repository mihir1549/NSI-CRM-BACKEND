import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { AnalyticsAdminService } from './analytics-admin.service.js';
import { AnalyticsQueryDto } from './dto/analytics-query.dto.js';

/**
 * AnalyticsAdminController — SUPER_ADMIN platform analytics routes.
 * All routes require JWT + RolesGuard(SUPER_ADMIN).
 * All routes accept ?from=&to= query params (ISO date strings).
 */
@Controller({ path: 'admin/analytics', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AnalyticsAdminController {
  constructor(private readonly analyticsAdminService: AnalyticsAdminService) {}

  /**
   * GET /api/v1/admin/analytics/dashboard
   * Platform overview with user, lead, revenue, and funnel stats.
   */
  @Get('dashboard')
  getDashboard(@Query() query: AnalyticsQueryDto) {
    return this.analyticsAdminService.getDashboard(query);
  }

  /**
   * GET /api/v1/admin/analytics/funnel
   * Funnel stage breakdown with dropoff rates.
   */
  @Get('funnel')
  getFunnelAnalytics(@Query() query: AnalyticsQueryDto) {
    return this.analyticsAdminService.getFunnelAnalytics(query);
  }

  /**
   * GET /api/v1/admin/analytics/revenue
   * Revenue analytics with chart data grouped by smart period.
   */
  @Get('revenue')
  getRevenueAnalytics(@Query() query: AnalyticsQueryDto) {
    return this.analyticsAdminService.getRevenueAnalytics(query);
  }

  /**
   * GET /api/v1/admin/analytics/leads
   * Lead analytics by status, source, and chart over time.
   */
  @Get('leads')
  getLeadsAnalytics(@Query() query: AnalyticsQueryDto) {
    return this.analyticsAdminService.getLeadsAnalytics(query);
  }

  /**
   * GET /api/v1/admin/analytics/distributors
   * Distributor performance analytics and rankings.
   */
  @Get('distributors')
  getDistributorsAnalytics(@Query() query: AnalyticsQueryDto) {
    return this.analyticsAdminService.getDistributorsAnalytics(query);
  }
}
