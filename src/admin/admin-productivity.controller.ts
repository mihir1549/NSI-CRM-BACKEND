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
  ParseUUIDPipe,
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
import { AdminTaskService } from './admin-task.service.js';
import { DistributorCalendarService } from '../distributor/distributor-calendar.service.js';
import { CreateTaskDto } from '../distributor/dto/create-task.dto.js';
import { UpdateTaskDto } from '../distributor/dto/update-task.dto.js';
import { MoveTaskDto } from '../distributor/dto/move-task.dto.js';
import { CalendarNoteDto } from '../distributor/dto/calendar-note.dto.js';
import { UpdateCalendarNoteDto } from '../distributor/dto/update-calendar-note.dto.js';
import { CalendarQueryDto } from '../distributor/dto/calendar-query.dto.js';
import {
  TaskGroupResponse,
  DistributorTaskResponse,
  TaskUpdateResponse,
  CalendarResponse,
} from '../distributor/dto/responses/distributor.responses.js';
import {
  ErrorResponse,
  MessageResponse,
} from '../common/dto/responses/error.response.js';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

@ApiTags('Admin Productivity')
@ApiBearerAuth('access-token')
@Controller({ path: 'admin', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminProductivityController {
  constructor(
    private readonly taskService: AdminTaskService,
    private readonly calendarService: DistributorCalendarService,
  ) {}

  // ─── Task endpoints ────────────────────────────────────────────────────────

  /**
   * GET /api/v1/admin/tasks
   */
  @ApiOperation({ summary: 'Admin: get all personal tasks grouped by status' })
  @ApiResponse({
    status: 200,
    description: 'Tasks grouped by status',
    type: TaskGroupResponse,
  })
  @Get('tasks')
  getTasks(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.taskService.getTasks(user.sub);
  }

  /**
   * POST /api/v1/admin/tasks
   */
  @ApiOperation({ summary: 'Admin: create a personal task' })
  @ApiResponse({
    status: 201,
    description: 'Task created',
    type: DistributorTaskResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error',
    type: ErrorResponse,
  })
  @Post('tasks')
  createTask(@Req() req: Request, @Body() dto: CreateTaskDto) {
    const user = req.user as JwtPayload;
    return this.taskService.createTask(user.sub, dto);
  }

  /**
   * PATCH /api/v1/admin/tasks/:uuid/move — static sub-route before :uuid
   */
  @ApiOperation({
    summary: 'Admin: move task to a different status column (drag and drop)',
  })
  @ApiParam({ name: 'uuid', description: 'Task UUID' })
  @ApiResponse({
    status: 200,
    description: 'Task moved',
    type: DistributorTaskResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'Task not found',
    type: ErrorResponse,
  })
  @Patch('tasks/:uuid/move')
  moveTask(
    @Req() req: Request,
    @Param('uuid', new ParseUUIDPipe()) uuid: string,
    @Body() dto: MoveTaskDto,
  ) {
    const user = req.user as JwtPayload;
    return this.taskService.moveTask(user.sub, uuid, dto);
  }

  /**
   * GET /api/v1/admin/tasks/:uuid/edit — static sub-route before :uuid
   */
  @ApiOperation({ summary: 'Admin: get task data for editing' })
  @ApiParam({ name: 'uuid', description: 'Task UUID' })
  @ApiResponse({
    status: 200,
    description: 'Task edit data',
    type: TaskUpdateResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'Task not found',
    type: ErrorResponse,
  })
  @Get('tasks/:uuid/edit')
  getTaskForUpdate(
    @Req() req: Request,
    @Param('uuid', new ParseUUIDPipe()) uuid: string,
  ) {
    const user = req.user as JwtPayload;
    return this.taskService.getTaskForUpdate(user.sub, uuid);
  }

  /**
   * PATCH /api/v1/admin/tasks/:uuid
   */
  @ApiOperation({ summary: 'Admin: update a task' })
  @ApiParam({ name: 'uuid', description: 'Task UUID' })
  @ApiResponse({
    status: 200,
    description: 'Task updated',
    type: DistributorTaskResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error',
    type: ErrorResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'Task not found',
    type: ErrorResponse,
  })
  @Patch('tasks/:uuid')
  updateTask(
    @Req() req: Request,
    @Param('uuid', new ParseUUIDPipe()) uuid: string,
    @Body() dto: UpdateTaskDto,
  ) {
    const user = req.user as JwtPayload;
    return this.taskService.updateTask(user.sub, uuid, dto);
  }

  /**
   * DELETE /api/v1/admin/tasks/:uuid
   */
  @ApiOperation({ summary: 'Admin: delete a task' })
  @ApiParam({ name: 'uuid', description: 'Task UUID' })
  @ApiResponse({
    status: 200,
    description: 'Task deleted',
    type: MessageResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'Task not found',
    type: ErrorResponse,
  })
  @Delete('tasks/:uuid')
  deleteTask(
    @Req() req: Request,
    @Param('uuid', new ParseUUIDPipe()) uuid: string,
  ) {
    const user = req.user as JwtPayload;
    return this.taskService.deleteTask(user.sub, uuid);
  }

  // ─── Calendar endpoints ────────────────────────────────────────────────────

  /**
   * GET /api/v1/admin/calendar?year=2026&month=4
   */
  @ApiOperation({
    summary:
      'Admin: get calendar events for a month (notes, tasks, follow-ups)',
  })
  @ApiQuery({
    name: 'year',
    required: true,
    type: Number,
    description: 'Year (e.g. 2026)',
  })
  @ApiQuery({
    name: 'month',
    required: true,
    type: Number,
    description: 'Month (1–12)',
  })
  @ApiResponse({
    status: 200,
    description: 'Calendar data',
    type: CalendarResponse,
  })
  @Get('calendar')
  getCalendar(@Req() req: Request, @Query() query: CalendarQueryDto) {
    const user = req.user as JwtPayload;
    return this.calendarService.getCalendar(user.sub, query.year, query.month);
  }

  /**
   * POST /api/v1/admin/calendar/notes — always creates a new note
   */
  @ApiOperation({
    summary: 'Admin: create a new calendar note (multiple per day supported)',
  })
  @ApiResponse({
    status: 201,
    description: 'Note created',
    type: CalendarResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error',
    type: ErrorResponse,
  })
  @Post('calendar/notes')
  createNote(@Req() req: Request, @Body() dto: CalendarNoteDto) {
    const user = req.user as JwtPayload;
    return this.calendarService.createNote(user.sub, dto);
  }

  /**
   * GET /api/v1/admin/calendar/notes/:uuid/edit — static sub-route before :uuid
   */
  @ApiOperation({
    summary: 'Admin: get a calendar note for editing (form pre-fill)',
  })
  @ApiParam({ name: 'uuid', description: 'Note UUID' })
  @ApiResponse({ status: 200, description: 'Note data for editing' })
  @ApiResponse({
    status: 404,
    description: 'Note not found',
    type: ErrorResponse,
  })
  @Get('calendar/notes/:uuid/edit')
  getNoteForEdit(
    @Req() req: Request,
    @Param('uuid', new ParseUUIDPipe()) uuid: string,
  ) {
    const user = req.user as JwtPayload;
    return this.calendarService.getNoteForEdit(user.sub, uuid);
  }

  /**
   * PATCH /api/v1/admin/calendar/notes/:uuid
   */
  @ApiOperation({ summary: 'Admin: update a specific calendar note' })
  @ApiParam({ name: 'uuid', description: 'Note UUID' })
  @ApiResponse({ status: 200, description: 'Note updated' })
  @ApiResponse({
    status: 400,
    description: 'Validation error',
    type: ErrorResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'Note not found',
    type: ErrorResponse,
  })
  @Patch('calendar/notes/:uuid')
  updateNote(
    @Req() req: Request,
    @Param('uuid', new ParseUUIDPipe()) uuid: string,
    @Body() dto: UpdateCalendarNoteDto,
  ) {
    const user = req.user as JwtPayload;
    return this.calendarService.updateNote(user.sub, uuid, dto);
  }

  /**
   * DELETE /api/v1/admin/calendar/notes/:uuid
   */
  @ApiOperation({ summary: 'Admin: delete a personal calendar note' })
  @ApiParam({ name: 'uuid', description: 'Note UUID' })
  @ApiResponse({
    status: 200,
    description: 'Note deleted',
    type: MessageResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'Note not found',
    type: ErrorResponse,
  })
  @Delete('calendar/notes/:uuid')
  deleteNote(
    @Req() req: Request,
    @Param('uuid', new ParseUUIDPipe()) uuid: string,
  ) {
    const user = req.user as JwtPayload;
    return this.calendarService.deleteNote(user.sub, uuid);
  }
}
