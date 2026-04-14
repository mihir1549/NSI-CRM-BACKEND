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
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { DistributorSubscriptionService } from './distributor-subscription.service.js';
import { DistributorSubscriptionHistoryService } from './distributor-subscription-history.service.js';
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
import { 
  SubscribeResponse, 
  SubscriptionHistoryResponse, 
  MySubscriptionResponse, 
  PaymentMethodUrlResponse, 
  SelfCancelResponse, 
  JoinLinkResponse, 
  DashboardResponse, 
  UtmAnalyticsResponse, 
  UsersAnalyticsResponse, 
  UsersListResponse, 
  DistributorUserItem, 
  TaskGroupResponse, 
  DistributorTaskResponse, 
  TaskUpdateResponse, 
  CalendarResponse, 
  NotificationsResponse 
} from './dto/responses/distributor.responses.js';
import { ErrorResponse, DeletedResponse, MessageResponse } from '../common/dto/responses/error.response.js';
import { DistributorPlan } from '@prisma/client';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

@ApiTags('Distributor')
@Controller({ path: 'distributor', version: '1' })
export class DistributorController {
  constructor(
    private readonly subscriptionService: DistributorSubscriptionService,
    private readonly historyService: DistributorSubscriptionHistoryService,
    private readonly distributorService: DistributorService,
    private readonly planService: DistributorPlanService,
    private readonly taskService: DistributorTaskService,
    private readonly calendarService: DistributorCalendarService,
  ) {}

  /**
   * POST /api/v1/distributor/subscribe
   * Auth: any authenticated user
   */
  @ApiOperation({ summary: 'Subscribe to a distributor plan' })
  @ApiBearerAuth('access-token')
  @ApiResponse({ status: 201, description: 'Subscription created', type: SubscribeResponse })
  @ApiResponse({ status: 400, description: 'Validation error', type: ErrorResponse })
  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  subscribe(@Req() req: Request, @Body() dto: SubscribeDto) {
    const user = req.user as JwtPayload;
    return this.subscriptionService.subscribe(user.sub, dto);
  }

  /**
   * GET /api/v1/distributor/subscription/history
   * Auth: DISTRIBUTOR — must be declared BEFORE GET /subscription
   */
  @ApiOperation({ summary: 'Get subscription payment history' })
  @ApiBearerAuth('access-token')
  @ApiResponse({ status: 200, description: 'Subscription history', type: [SubscriptionHistoryResponse] })
  @Get('subscription/history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DISTRIBUTOR')
  getSubscriptionHistory(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.historyService.getHistory(user.sub);
  }

  /**
   * GET /api/v1/distributor/subscription
   * Auth: DISTRIBUTOR
   */
  @ApiOperation({ summary: 'Get current distributor subscription' })
  @ApiBearerAuth('access-token')
  @ApiResponse({ status: 200, description: 'Current subscription', type: MySubscriptionResponse })
  @Get('subscription')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DISTRIBUTOR')
  getMySubscription(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.subscriptionService.getMySubscription(user.sub);
  }

  /**
   * POST /api/v1/distributor/subscription/cancel
   * Auth: DISTRIBUTOR — self-cancel subscription at end of billing period
   * MUST be declared before any :uuid param routes.
   */
  @ApiOperation({ summary: 'Self-cancel subscription at end of billing period' })
  @ApiBearerAuth('access-token')
  @ApiResponse({ status: 201, description: 'Cancellation scheduled', type: SelfCancelResponse })
  @ApiResponse({ status: 400, description: 'Bad request', type: ErrorResponse })
  @ApiResponse({ status: 404, description: 'Subscription not found', type: ErrorResponse })
  @Post('subscription/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DISTRIBUTOR')
  selfCancelSubscription(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.subscriptionService.selfCancelSubscription(user.sub);
  }

  /**
   * GET /api/v1/distributor/subscription/payment-method-url
   * Auth: DISTRIBUTOR — get Razorpay short URL to update payment method (only when HALTED)
   */
  @ApiOperation({ summary: 'Get Razorpay URL to update payment method' })
  @ApiBearerAuth('access-token')
  @ApiResponse({ status: 200, description: 'Payment method update URL', type: PaymentMethodUrlResponse })
  @ApiResponse({ status: 400, description: 'No payment issue found', type: ErrorResponse })
  @Get('subscription/payment-method-url')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DISTRIBUTOR')
  getPaymentMethodUrl(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.subscriptionService.getPaymentMethodUrl(user.sub);
  }

  /**
   * GET /api/v1/distributor/join-link
   * Auth: DISTRIBUTOR
   */
  @ApiOperation({ summary: 'Get distributor referral join link' })
  @ApiBearerAuth('access-token')
  @ApiResponse({ status: 200, description: 'Join link URL', type: JoinLinkResponse })
  @ApiResponse({ status: 404, description: 'Distributor code not found', type: ErrorResponse })
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
  @ApiOperation({ summary: 'Get distributor dashboard stats' })
  @ApiBearerAuth('access-token')
  @ApiResponse({ status: 200, description: 'Dashboard data', type: DashboardResponse })
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
  @ApiOperation({ summary: 'Get UTM analytics for distributor' })
  @ApiBearerAuth('access-token')
  @ApiResponse({ status: 200, description: 'UTM analytics data', type: UtmAnalyticsResponse })
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
  @ApiOperation({ summary: 'Resolve a distributor join code (public)' })
  @ApiParam({ name: 'code', description: 'Distributor join code' })
  @ApiResponse({ status: 200, description: 'Join code resolved', schema: { type: 'object', properties: { distributorUuid: { type: 'string' }, fullName: { type: 'string' }, code: { type: 'string' }, isActive: { type: 'boolean' } } } })
  @ApiResponse({ status: 404, description: 'Join code not found', type: ErrorResponse })
  @Get('/join/:code')
  resolveJoinCode(@Param('code') code: string) {
    return this.distributorService.resolveJoinCode(code);
  }

  /**
   * GET /api/v1/distributor/users/analytics
   * Auth: DISTRIBUTOR — MUST be declared before /users/:uuid
   */
  @ApiOperation({ summary: 'Get users analytics for distributor' })
  @ApiBearerAuth('access-token')
  @ApiResponse({ status: 200, description: 'Users analytics data', type: UsersAnalyticsResponse })
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
  @ApiOperation({ summary: 'List users referred by this distributor' })
  @ApiBearerAuth('access-token')
  @ApiResponse({ status: 200, description: 'Paginated user list', type: UsersListResponse })
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
  @ApiOperation({ summary: 'Get detail for a specific referred user' })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'uuid', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User detail', type: DistributorUserItem })
  @ApiResponse({ status: 403, description: 'User not in distributor network', type: ErrorResponse })
  @ApiResponse({ status: 404, description: 'User not found', type: ErrorResponse })
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
  @ApiOperation({ summary: 'Get active distributor plans' })
  @ApiBearerAuth('access-token')
  @ApiResponse({ status: 200, description: 'Active plans list', schema: { type: 'array', items: { type: 'object' } } })
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
  @ApiOperation({ summary: 'Get all tasks for current distributor' })
  @ApiBearerAuth('access-token')
  @ApiResponse({ status: 200, description: 'Task list grouped by status', type: TaskGroupResponse })
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
  @ApiOperation({ summary: 'Create a task' })
  @ApiBearerAuth('access-token')
  @ApiResponse({ status: 201, description: 'Task created', type: DistributorTaskResponse })
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
  @ApiOperation({ summary: 'Move task to a different status column' })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'uuid', description: 'Task UUID' })
  @ApiResponse({ status: 200, description: 'Task moved', type: DistributorTaskResponse })
  @Patch('tasks/:uuid/move')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DISTRIBUTOR')
  moveTask(@Req() req: Request, @Param('uuid') uuid: string, @Body() dto: MoveTaskDto) {
    const user = req.user as JwtPayload;
    return this.taskService.moveTask(user.sub, uuid, dto);
  }

  /**
   * GET /api/v1/distributor/tasks/:uuid/edit
   * Auth: DISTRIBUTOR
   */
  @ApiOperation({ summary: 'Get task data for editing' })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'uuid', description: 'Task UUID' })
  @ApiResponse({ status: 200, description: 'Task edit data', type: TaskUpdateResponse })
  @ApiResponse({ status: 404, description: 'Task not found', type: ErrorResponse })
  @Get('tasks/:uuid/edit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DISTRIBUTOR')
  getTaskForUpdate(@Req() req: Request, @Param('uuid') uuid: string) {
    const user = req.user as JwtPayload;
    return this.taskService.getTaskForUpdate(user.sub, uuid);
  }

  /**
   * PATCH /api/v1/distributor/tasks/:uuid
   * Auth: DISTRIBUTOR
   */
  @ApiOperation({ summary: 'Update a task' })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'uuid', description: 'Task UUID' })
  @ApiResponse({ status: 200, description: 'Task updated', type: DistributorTaskResponse })
  @ApiResponse({ status: 404, description: 'Task not found', type: ErrorResponse })
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
  @ApiOperation({ summary: 'Delete a task' })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'uuid', description: 'Task UUID' })
  @ApiResponse({ status: 200, description: 'Task deleted', type: MessageResponse })
  @ApiResponse({ status: 404, description: 'Task not found', type: ErrorResponse })
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
  @ApiOperation({ summary: 'Get calendar notes and tasks for a month' })
  @ApiBearerAuth('access-token')
  @ApiQuery({ name: 'year', required: true, type: Number, description: 'Year (e.g. 2026)' })
  @ApiQuery({ name: 'month', required: true, type: Number, description: 'Month (1-12)' })
  @ApiResponse({ status: 200, description: 'Calendar data', type: CalendarResponse })
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
  @ApiOperation({ summary: 'Create or update a calendar note' })
  @ApiBearerAuth('access-token')
  @ApiResponse({ status: 201, description: 'Note saved', schema: { type: 'object', properties: { uuid: { type: 'string' } } } })
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
  @ApiOperation({ summary: 'Delete a calendar note' })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'uuid', description: 'Note UUID' })
  @ApiResponse({ status: 200, description: 'Note deleted', type: MessageResponse })
  @ApiResponse({ status: 404, description: 'Note not found', type: ErrorResponse })
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
  @ApiOperation({ summary: 'Get distributor notifications (overdue/due tasks)' })
  @ApiBearerAuth('access-token')
  @ApiResponse({ status: 200, description: 'Notifications list', type: NotificationsResponse })
  @Get('notifications')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DISTRIBUTOR')
  getNotifications(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.taskService.getNotifications(user.sub);
  }
}
