import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { DistributorsAdminService } from './distributors-admin.service.js';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

/**
 * DistributorsAdminController — SUPER_ADMIN distributor management routes.
 * All routes require JWT + RolesGuard(SUPER_ADMIN).
 */
@Controller({ path: 'admin/distributors', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class DistributorsAdminController {
  constructor(private readonly distributorsAdminService: DistributorsAdminService) {}

  /**
   * GET /api/v1/admin/distributors
   * List all distributors with stats.
   */
  @Get()
  listDistributors(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.distributorsAdminService.listDistributors({
      search,
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * GET /api/v1/admin/distributors/:uuid
   * Full distributor detail with recent leads and performance analytics.
   */
  @Get(':uuid')
  getDistributorDetail(@Param('uuid') uuid: string) {
    return this.distributorsAdminService.getDistributorDetail(uuid);
  }

  /**
   * PATCH /api/v1/admin/distributors/:uuid/deactivate-link
   * Deactivate a distributor's join link.
   */
  @Patch(':uuid/deactivate-link')
  deactivateLink(@Req() req: Request, @Param('uuid') uuid: string) {
    const user = req.user as JwtPayload;
    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip ?? '';
    return this.distributorsAdminService.deactivateLink(uuid, user.sub, ip);
  }

  /**
   * PATCH /api/v1/admin/distributors/:uuid/activate-link
   * Activate a distributor's join link.
   */
  @Patch(':uuid/activate-link')
  activateLink(@Req() req: Request, @Param('uuid') uuid: string) {
    const user = req.user as JwtPayload;
    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip ?? '';
    return this.distributorsAdminService.activateLink(uuid, user.sub, ip);
  }
}
