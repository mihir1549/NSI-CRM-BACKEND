import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { LeadsService } from '../leads/leads.service.js';
import { AdminNotificationsResponse } from '../leads/dto/responses/leads.responses.js';

/**
 * NotificationsAdminController — SUPER_ADMIN notification endpoints.
 * Returns actionable follow-up notifications for direct/organic leads.
 */
@ApiTags('Admin - Users')
@ApiBearerAuth('access-token')
@Controller({ path: 'admin/notifications', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class NotificationsAdminController {
  constructor(private readonly leadsService: LeadsService) {}

  /**
   * GET /api/v1/admin/notifications
   * Returns followups due today and overdue followups for direct/organic leads.
   */
  @ApiOperation({ summary: 'Admin: get actionable lead follow-up notifications' })
  @ApiResponse({ status: 200, description: 'Notifications list', type: AdminNotificationsResponse })
  @Get()
  getNotifications() {
    return this.leadsService.getAdminNotifications();
  }
}
