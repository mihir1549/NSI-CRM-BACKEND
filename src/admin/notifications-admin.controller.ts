import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { LeadsService } from '../leads/leads.service.js';

/**
 * NotificationsAdminController — SUPER_ADMIN notification endpoints.
 * Returns actionable follow-up notifications for direct/organic leads.
 */
@Controller({ path: 'admin/notifications', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class NotificationsAdminController {
  constructor(private readonly leadsService: LeadsService) {}

  /**
   * GET /api/v1/admin/notifications
   * Returns followups due today and overdue followups for direct/organic leads.
   */
  @Get()
  getNotifications() {
    return this.leadsService.getAdminNotifications();
  }
}
