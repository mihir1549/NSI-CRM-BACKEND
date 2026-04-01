import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { FunnelCmsService } from '../funnel-cms/funnel-cms.service.js';

/**
 * AnalyticsController — admin analytics APIs.
 * All routes require JwtAuthGuard + RolesGuard(SUPER_ADMIN).
 *
 * Hosted at /admin/analytics/* — separate from funnel-cms controller
 * but reuses FunnelCmsService for the query logic.
 */
@Controller({ path: 'admin/analytics', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AnalyticsController {
  constructor(private readonly cmsService: FunnelCmsService) {}

  @Get('funnel')
  getFunnelAnalytics() {
    return this.cmsService.getFunnelAnalytics();
  }

  @Get('utm')
  getUtmAnalytics() {
    return this.cmsService.getUtmAnalytics();
  }

  @Get('devices')
  getDeviceAnalytics() {
    return this.cmsService.getDeviceAnalytics();
  }

  @Get('conversions')
  getConversionAnalytics() {
    return this.cmsService.getConversionAnalytics();
  }
}
