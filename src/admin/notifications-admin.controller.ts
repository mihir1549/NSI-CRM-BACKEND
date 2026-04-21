import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { LeadsService } from '../leads/leads.service.js';
import { AdminTaskService } from './admin-task.service.js';
import { AdminNotificationsResponse } from '../leads/dto/responses/leads.responses.js';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

/**
 * NotificationsAdminController — SUPER_ADMIN notification endpoints.
 * Returns actionable follow-up notifications for direct/organic leads,
 * plus personal task board notifications (due today + overdue).
 */
@ApiTags('Admin - Users')
@ApiBearerAuth('access-token')
@Controller({ path: 'admin/notifications', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class NotificationsAdminController {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly taskService: AdminTaskService,
  ) {}

  /**
   * GET /api/v1/admin/notifications
   * Returns followups due today, overdue followups (direct/organic leads),
   * plus admin's personal tasks due today and overdue tasks.
   */
  @ApiOperation({
    summary: 'Admin: get lead follow-ups and personal task notifications',
  })
  @ApiResponse({
    status: 200,
    description: 'Notifications list',
    type: AdminNotificationsResponse,
  })
  @SkipThrottle()
  @Get()
  async getNotifications(@Req() req: Request) {
    const user = req.user as JwtPayload;
    const [leadNotifications, taskNotifications] = await Promise.all([
      this.leadsService.getAdminNotifications(),
      this.taskService.getTaskNotifications(user.sub),
    ]);

    return {
      ...leadNotifications,
      ...taskNotifications,
    };
  }
}
