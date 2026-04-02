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
import { UsersAdminService } from './users-admin.service.js';
import { UpdateUserRoleDto } from './dto/update-user-role.dto.js';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

/**
 * UsersAdminController — SUPER_ADMIN user management routes.
 * All routes require JWT + RolesGuard(SUPER_ADMIN).
 */
@Controller({ path: 'admin/users', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class UsersAdminController {
  constructor(private readonly usersAdminService: UsersAdminService) {}

  /**
   * GET /api/v1/admin/users
   * List all users with optional filters and pagination.
   */
  @Get()
  listUsers(
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('country') country?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.usersAdminService.listUsers({
      role,
      status,
      country,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * GET /api/v1/admin/users/:uuid
   * Full user detail including payment history, funnel progress, LMS, lead.
   * Must be declared BEFORE specific sub-routes.
   */
  @Get(':uuid')
  getUserDetail(@Param('uuid') uuid: string) {
    return this.usersAdminService.getUserDetail(uuid);
  }

  /**
   * PATCH /api/v1/admin/users/:uuid/suspend
   * Suspend a user account.
   */
  @Patch(':uuid/suspend')
  suspendUser(@Req() req: Request, @Param('uuid') uuid: string) {
    const user = req.user as JwtPayload;
    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip ?? '';
    return this.usersAdminService.suspendUser(uuid, user.sub, ip);
  }

  /**
   * PATCH /api/v1/admin/users/:uuid/reactivate
   * Reactivate a suspended user account.
   */
  @Patch(':uuid/reactivate')
  reactivateUser(@Req() req: Request, @Param('uuid') uuid: string) {
    const user = req.user as JwtPayload;
    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip ?? '';
    return this.usersAdminService.reactivateUser(uuid, user.sub, ip);
  }

  /**
   * PATCH /api/v1/admin/users/:uuid/role
   * Update a user's role.
   */
  @Patch(':uuid/role')
  updateUserRole(
    @Req() req: Request,
    @Param('uuid') uuid: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    const user = req.user as JwtPayload;
    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip ?? '';
    return this.usersAdminService.updateUserRole(uuid, dto, user.sub, ip);
  }
}
