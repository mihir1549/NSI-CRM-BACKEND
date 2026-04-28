import {
  Controller,
  Get,
  Patch,
  Param,
  ParseUUIDPipe,
  Body,
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
import { UsersAdminService } from './users-admin.service.js';
import { UpdateUserRoleDto } from './dto/update-user-role.dto.js';
import {
  AdminUserListResponse,
  AdminUserDetailResponse,
  AdminMessageResponse,
} from './dto/responses/admin.responses.js';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

/**
 * UsersAdminController — SUPER_ADMIN user management routes.
 * All routes require JWT + RolesGuard(SUPER_ADMIN).
 */
@ApiTags('Admin - Users')
@ApiBearerAuth('access-token')
@Controller({ path: 'admin/users', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class UsersAdminController {
  constructor(private readonly usersAdminService: UsersAdminService) {}

  /**
   * GET /api/v1/admin/users
   * List all users with optional filters and pagination.
   */
  @ApiOperation({
    summary: 'Admin: list all users with filters and pagination',
  })
  @ApiQuery({ name: 'role', required: false, description: 'Filter by role' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status',
  })
  @ApiQuery({
    name: 'country',
    required: false,
    description: 'Filter by country code',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by name or email',
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
    description: 'Paginated users list',
    type: AdminUserListResponse,
  })
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
  @ApiOperation({ summary: 'Admin: get full user detail' })
  @ApiParam({ name: 'uuid', description: 'User UUID' })
  @ApiResponse({
    status: 200,
    description: 'Full user detail',
    type: AdminUserDetailResponse,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @Get(':uuid')
  getUserDetail(@Param('uuid', new ParseUUIDPipe()) uuid: string) {
    return this.usersAdminService.getUserDetail(uuid);
  }

  /**
   * PATCH /api/v1/admin/users/:uuid/suspend
   * Suspend a user account.
   */
  @ApiOperation({ summary: 'Admin: suspend a user account' })
  @ApiParam({ name: 'uuid', description: 'User UUID' })
  @ApiResponse({
    status: 200,
    description: 'User suspended',
    type: AdminMessageResponse,
  })
  @ApiResponse({ status: 400, description: 'User is already suspended' })
  @ApiResponse({
    status: 403,
    description: 'Cannot suspend a Super Admin account',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @Patch(':uuid/suspend')
  suspendUser(
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
    return this.usersAdminService.suspendUser(uuid, user.sub, ip);
  }

  /**
   * PATCH /api/v1/admin/users/:uuid/reactivate
   * Reactivate a suspended user account.
   */
  @ApiOperation({ summary: 'Admin: reactivate a suspended user' })
  @ApiParam({ name: 'uuid', description: 'User UUID' })
  @ApiResponse({
    status: 200,
    description: 'User reactivated',
    type: AdminMessageResponse,
  })
  @ApiResponse({ status: 400, description: 'User is not suspended' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @Patch(':uuid/reactivate')
  reactivateUser(
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
    return this.usersAdminService.reactivateUser(uuid, user.sub, ip);
  }

  /**
   * PATCH /api/v1/admin/users/:uuid/role
   * Update a user's role.
   */
  @ApiOperation({ summary: 'Admin: update user role' })
  @ApiParam({ name: 'uuid', description: 'User UUID' })
  @ApiResponse({
    status: 200,
    description: 'Role updated',
    type: AdminMessageResponse,
  })
  @ApiResponse({ status: 403, description: 'Forbidden action' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @Patch(':uuid/role')
  updateUserRole(
    @Req() req: Request,
    @Param('uuid', new ParseUUIDPipe()) uuid: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    const user = req.user as JwtPayload;
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)
        ?.split(',')[0]
        ?.trim() ??
      req.ip ??
      '';
    return this.usersAdminService.updateUserRole(uuid, dto, user.sub, ip);
  }

  /**
   * PATCH /api/v1/admin/users/payments/:paymentUuid/expire
   * Force-expire a stuck PENDING payment.
   */
  @ApiOperation({ summary: 'Admin: force-expire a stuck PENDING payment' })
  @ApiParam({ name: 'paymentUuid', description: 'Payment UUID' })
  @ApiResponse({
    status: 200,
    description: 'Payment expired',
    type: AdminMessageResponse,
  })
  @ApiResponse({ status: 400, description: 'Payment is not in PENDING state' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @Patch('payments/:paymentUuid/expire')
  expirePendingPayment(
    @Req() req: Request,
    @Param('paymentUuid', new ParseUUIDPipe()) paymentUuid: string,
  ) {
    const user = req.user as JwtPayload;
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)
        ?.split(',')[0]
        ?.trim() ??
      req.ip ??
      '';
    return this.usersAdminService.expirePendingPayment(paymentUuid, user.sub, ip);
  }
}
