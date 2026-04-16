import {
  Controller,
  Get,
  Patch,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  Req,
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
import { DistributorsAdminService } from './distributors-admin.service.js';
import {
  AdminDistributorListResponse,
  AdminDistributorDetailResponse,
  AdminMessageResponse,
} from './dto/responses/admin.responses.js';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

/**
 * DistributorsAdminController — SUPER_ADMIN distributor management routes.
 * All routes require JWT + RolesGuard(SUPER_ADMIN).
 */
@ApiTags('Distributor - Admin')
@ApiBearerAuth('access-token')
@Controller({ path: 'admin/distributors', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class DistributorsAdminController {
  constructor(
    private readonly distributorsAdminService: DistributorsAdminService,
  ) {}

  /**
   * GET /api/v1/admin/distributors
   * List all distributors with stats.
   */
  @ApiOperation({ summary: 'Admin: list all distributors with stats' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by name or email',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated distributors list',
    type: AdminDistributorListResponse,
  })
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
  @ApiOperation({ summary: 'Admin: get distributor detail with analytics' })
  @ApiParam({ name: 'uuid', description: 'Distributor UUID' })
  @ApiResponse({
    status: 200,
    description: 'Distributor detail',
    type: AdminDistributorDetailResponse,
  })
  @ApiResponse({ status: 404, description: 'Distributor not found' })
  @Get(':uuid')
  getDistributorDetail(@Param('uuid', new ParseUUIDPipe()) uuid: string) {
    return this.distributorsAdminService.getDistributorDetail(uuid);
  }

  /**
   * PATCH /api/v1/admin/distributors/:uuid/deactivate-link
   * Deactivate a distributor's join link.
   */
  @ApiOperation({ summary: 'Admin: deactivate distributor join link' })
  @ApiParam({ name: 'uuid', description: 'Distributor UUID' })
  @ApiResponse({
    status: 200,
    description: 'Join link deactivated',
    type: AdminMessageResponse,
  })
  @ApiResponse({ status: 404, description: 'Distributor not found' })
  @Patch(':uuid/deactivate-link')
  deactivateLink(
    @Req() req: Request,
    @Param('uuid', new ParseUUIDPipe()) uuid: string,
  ) {
    const user = req.user as JwtPayload;
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)
        ?.split(',')[0]
        ?.trim() ??
      req.ip ??
      '';
    return this.distributorsAdminService.deactivateLink(uuid, user.sub, ip);
  }

  /**
   * PATCH /api/v1/admin/distributors/:uuid/activate-link
   * Activate a distributor's join link.
   */
  @ApiOperation({ summary: 'Admin: activate distributor join link' })
  @ApiParam({ name: 'uuid', description: 'Distributor UUID' })
  @ApiResponse({
    status: 200,
    description: 'Join link activated',
    type: AdminMessageResponse,
  })
  @ApiResponse({ status: 404, description: 'Distributor not found' })
  @Patch(':uuid/activate-link')
  activateLink(
    @Req() req: Request,
    @Param('uuid', new ParseUUIDPipe()) uuid: string,
  ) {
    const user = req.user as JwtPayload;
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)
        ?.split(',')[0]
        ?.trim() ??
      req.ip ??
      '';
    return this.distributorsAdminService.activateLink(uuid, user.sub, ip);
  }
}
