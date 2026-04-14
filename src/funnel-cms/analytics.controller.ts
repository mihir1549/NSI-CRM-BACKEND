import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { FunnelCmsService } from '../funnel-cms/funnel-cms.service.js';
import {
  CmsAnalyticsFunnelStep,
  CmsAnalyticsUtmResponse,
  CmsAnalyticsDeviceResponse,
  CmsAnalyticsConversionResponse,
} from './dto/responses/funnel-cms.responses.js';

/**
 * AnalyticsController — admin analytics APIs.
 * All routes require JwtAuthGuard + RolesGuard(SUPER_ADMIN).
 *
 * Hosted at /admin/analytics/* — separate from funnel-cms controller
 * but reuses FunnelCmsService for the query logic.
 */
@ApiTags('Funnel CMS')
@ApiBearerAuth('access-token')
@Controller({ path: 'admin/analytics', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AnalyticsController {
  constructor(private readonly cmsService: FunnelCmsService) {}

  @ApiOperation({ summary: 'Get funnel conversion analytics' })
  @ApiResponse({ status: 200, description: 'Funnel analytics', type: [CmsAnalyticsFunnelStep] })
  @Get('funnel')
  getFunnelAnalytics() {
    return this.cmsService.getFunnelAnalytics();
  }

  @ApiOperation({ summary: 'Get UTM source analytics' })
  @ApiResponse({ status: 200, description: 'UTM analytics', type: CmsAnalyticsUtmResponse })
  @Get('utm')
  getUtmAnalytics() {
    return this.cmsService.getUtmAnalytics();
  }

  @ApiOperation({ summary: 'Get device type analytics' })
  @ApiResponse({ status: 200, description: 'Device analytics', type: CmsAnalyticsDeviceResponse })
  @Get('devices')
  getDeviceAnalytics() {
    return this.cmsService.getDeviceAnalytics();
  }

  @ApiOperation({ summary: 'Get conversion rate analytics' })
  @ApiResponse({ status: 200, description: 'Conversion analytics', type: CmsAnalyticsConversionResponse })
  @Get('conversions')
  getConversionAnalytics() {
    return this.cmsService.getConversionAnalytics();
  }
}
