import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Query,
  UseGuards,
  Req,
  Param,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { DistributorSubscriptionService } from './distributor-subscription.service.js';
import { DistributorService } from './distributor.service.js';
import { DistributorPlanService } from './distributor-plan.service.js';
import { DistributorTaskService } from './distributor-task.service.js';
import { DistributorCalendarService } from './distributor-calendar.service.js';
import { SubscribeDto } from './dto/subscribe.dto.js';
import { UtmQueryDto } from './dto/utm-query.dto.js';
import { DistributorUsersQueryDto } from './dto/distributor-users-query.dto.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { MoveTaskDto } from './dto/move-task.dto.js';
import { CalendarNoteDto } from './dto/calendar-note.dto.js';
import { CalendarQueryDto } from './dto/calendar-query.dto.js';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

@Controller({ path: 'distributor', version: '1' })
export class DistributorController {
  constructor(
    private readonly subscriptionService: DistributorSubscriptionService,
    private readonly distributorService: DistributorService,
    private readonly planService: DistributorPlanService,
    private readonly taskService: DistributorTaskService,
    private readonly calendarService: DistributorCalendarService,
  ) {}

  /**
   * POST /api/v1/distributor/subscribe
   * Auth: any authenticated user
   */
  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  subscribe(@Req() req: Request, @Body() dto: SubscribeDto) {
    const user = req.user as JwtPayload;
    return this.subscriptionService.subscribe(user.sub, dto);
  }

  /**
   * GET /api/v1/distributor/subscription
   * Auth: DISTRIBUTOR
   */
  @Get('subscription')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DISTRIBUTOR')
  getMySubscription(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.subscriptionService.getMySubscription(user.sub);
  }

  /**
   * GET /api/v1/distributor/join-link
   * Auth: DISTRIBUTOR
   */
  @Get('join-link')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DISTRIBUTOR')
  getJoinLink(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.distributorService.getJoinLink(user.sub);
  }

  /**
   * GET /api/v1/distributor/dashboard
   * Auth: DISTRIBUTOR
   */
  @Get('dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DISTRIBUTOR')
  getDashboard(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.distributorService.getDashboard(user.sub);
  }

  /**
   * GET /api/v1/distributor/analytics/utm
   * Auth: DISTRIBUTOR
   */
  @Get('analytics/utm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DISTRIBUTOR')
  getUtmAnalytics(@Req() req: Request, @Query() query: UtmQueryDto) {
    const user = req.user as JwtPayload;
    return this.distributorService.getUtmAnalytics(user.sub, query);
  }

  /**
   * GET /api/v1/join/:code
   * Public — no auth required
   */
  @Get('/join/:code')
  resolveJoinCode(@Param('code') code: string) {
    return this.distributorService.resolveJoinCode(code);
  }

  /**
   * GET /api/v1/distributor/users/analytics
   * Auth: DISTRIBUTOR — MUST be declared before /users/:uuid
   */
  @Get('users/analytics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DISTRIBUTOR')
  getUsersAnalytics(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.distributorService.getUsersAnalytics(user.sub);
  }

  /**
   * GET /api/v1/distributor/users
   * Auth: DISTRIBUTOR
   */
  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DISTRIBUTOR')
  listUsers(@Req() req: Request, @Query() query: DistributorUsersQueryDto) {
    const user = req.user as JwtPayload;
    return this.distributorService.listUsers(user.sub, query);
  }

  /**
   * GET /api/v1/distributor/users/:uuid
   * Auth: DISTRIBUTOR — only exposes users belonging to this distributor
   */
  @Get('users/:uuid')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DISTRIBUTOR')
  getUserDetail(@Req() req: Request, @Param('uuid') uuid: string) {
    const user = req.user as JwtPayload;
    return this.distributorService.getUserDetail(user.sub, uuid);
  }

  /**
   * GET /api/v1/distributor/plans
   * Auth: any authenticated user
   */
  @Get('plans')
  @UseGuards(JwtAuthGuard)
  getActivePlans() {
    return this.planService.getActivePlans();
  }

  // ─── Task endpoints ────────────────────────────────────────────────────────

  /**
   * GET /api/v1/distributor/tasks
   * Auth: DISTRIBUTOR
   */
  @Get('tasks')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DISTRIBUTOR')
  getTasks(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.taskService.getTasks(user.sub);
  }

  /**
   * POST /api/v1/distributor/tasks
   * Auth: DISTRIBUTOR
   */
  @Post('tasks')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DISTRIBUTOR')
  createTask(@Req() req: Request, @Body() dto: CreateTaskDto) {
    const user = req.user as JwtPayload;
    return this.taskService.createTask(user.sub, dto);
  }

  /**
   * PATCH /api/v1/distributor/tasks/:uuid/move — must be declared before /tasks/:uuid
   * Auth: DISTRIBUTOR
   */
  @Patch('tasks/:uuid/move')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DISTRIBUTOR')
  moveTask(@Req() req: Request, @Param('uuid') uuid: string, @Body() dto: MoveTaskDto) {
    const user = req.user as JwtPayload;
    return this.taskService.moveTask(user.sub, uuid, dto);
  }

  /**
   * PATCH /api/v1/distributor/tasks/:uuid
   * Auth: DISTRIBUTOR
   */
  @Patch('tasks/:uuid')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DISTRIBUTOR')
  updateTask(@Req() req: Request, @Param('uuid') uuid: string, @Body() dto: UpdateTaskDto) {
    const user = req.user as JwtPayload;
    return this.taskService.updateTask(user.sub, uuid, dto);
  }

  /**
   * DELETE /api/v1/distributor/tasks/:uuid
   * Auth: DISTRIBUTOR
   */
  @Delete('tasks/:uuid')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DISTRIBUTOR')
  deleteTask(@Req() req: Request, @Param('uuid') uuid: string) {
    const user = req.user as JwtPayload;
    return this.taskService.deleteTask(user.sub, uuid);
  }

  // ─── Calendar endpoints ────────────────────────────────────────────────────

  /**
   * GET /api/v1/distributor/calendar?year=2026&month=4
   * Auth: DISTRIBUTOR
   */
  @Get('calendar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DISTRIBUTOR')
  getCalendar(@Req() req: Request, @Query() query: CalendarQueryDto) {
    const user = req.user as JwtPayload;
    return this.calendarService.getCalendar(user.sub, query.year, query.month);
  }

  /**
   * POST /api/v1/distributor/calendar/notes
   * Auth: DISTRIBUTOR
   */
  @Post('calendar/notes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DISTRIBUTOR')
  upsertNote(@Req() req: Request, @Body() dto: CalendarNoteDto) {
    const user = req.user as JwtPayload;
    return this.calendarService.upsertNote(user.sub, dto);
  }

  /**
   * DELETE /api/v1/distributor/calendar/notes/:uuid
   * Auth: DISTRIBUTOR
   */
  @Delete('calendar/notes/:uuid')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DISTRIBUTOR')
  deleteNote(@Req() req: Request, @Param('uuid') uuid: string) {
    const user = req.user as JwtPayload;
    return this.calendarService.deleteNote(user.sub, uuid);
  }

  // ─── Notifications endpoint ────────────────────────────────────────────────

  /**
   * GET /api/v1/distributor/notifications
   * Auth: DISTRIBUTOR
   */
  @Get('notifications')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DISTRIBUTOR')
  getNotifications(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.taskService.getNotifications(user.sub);
  }
}
