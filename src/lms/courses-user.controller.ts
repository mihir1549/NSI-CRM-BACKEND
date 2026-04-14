import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';
import { CoursesUserService } from './courses-user.service.js';
import { EnrollmentService } from './enrollment.service.js';
import { LessonProgressDto } from './dto/lesson-progress.dto.js';
import {
  CourseUserListResponse,
  CourseUserDetailResponse,
  CourseUserLearnResponse,
  MyCoursesListResponse,
  LessonUserDetailResponse,
  LessonProgressResponse,
  LessonCompleteResponse,
  EnrollmentResponse,
  CertificateResponse,
  LessonLearnResponse
} from './dto/responses/lms-user.responses.js';
import { ErrorResponse } from '../common/dto/responses/error.response.js';

/**
 * CoursesUserController — user-facing LMS routes.
 * All routes require JWT + RolesGuard(CUSTOMER, DISTRIBUTOR).
 */
@ApiTags('LMS - User')
@ApiBearerAuth('access-token')
@Controller({ path: 'lms', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CUSTOMER', 'DISTRIBUTOR')
export class CoursesUserController {
  constructor(
    private readonly userService: CoursesUserService,
    private readonly enrollmentService: EnrollmentService,
  ) {}

  // ─── BROWSE COURSES ───────────────────────────────────────

  @ApiOperation({ summary: 'List all published courses' })
  @ApiResponse({ status: 200, description: 'Published courses with enrollment status', type: [CourseUserListResponse] })
  @Get('courses')
  findAllCourses(@CurrentUser() user: JwtPayload) {
    return this.userService.findAllPublished(user.sub);
  }

  @ApiOperation({ summary: 'Get course detail with enrollment status' })
  @ApiParam({ name: 'uuid', description: 'Course UUID' })
  @ApiResponse({ status: 200, description: 'Course detail', type: CourseUserDetailResponse })
  @ApiResponse({ status: 404, description: 'Course not found', type: ErrorResponse })
  @Get('courses/:uuid')
  findOneCourse(
    @Param('uuid') courseUuid: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.userService.findOneCourse(courseUuid, user.sub);
  }

  // ─── ENROLLMENT ───────────────────────────────────────────

  @ApiOperation({ summary: 'Enroll in a course' })
  @ApiParam({ name: 'uuid', description: 'Course UUID' })
  @ApiResponse({ status: 200, description: 'Enrolled successfully', type: EnrollmentResponse })
  @ApiResponse({ status: 400, description: 'Already enrolled', type: ErrorResponse })
  @ApiResponse({ status: 403, description: 'Payment required', type: ErrorResponse })
  @Post('courses/:uuid/enroll')
  @HttpCode(HttpStatus.OK)
  enrollCourse(
    @Param('uuid') courseUuid: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.enrollmentService.enroll(user.sub, courseUuid);
  }

  @ApiOperation({ summary: 'Get course learning content (requires enrollment)' })
  @ApiParam({ name: 'uuid', description: 'Course UUID' })
  @ApiResponse({ status: 200, description: 'Course learn content', type: CourseUserLearnResponse })
  @ApiResponse({ status: 403, description: 'Not enrolled', type: ErrorResponse })
  @ApiResponse({ status: 404, description: 'Course not found', type: ErrorResponse })
  @Get('courses/:uuid/learn')
  getCourseLearnContent(
    @Param('uuid') courseUuid: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.userService.getCourseLearnContent(courseUuid, user.sub);
  }

  @ApiOperation({ summary: 'List enrolled courses for current user' })
  @ApiResponse({ status: 200, description: 'User enrolled courses', type: MyCoursesListResponse })
  @Get('my-courses')
  getMyCourses(@CurrentUser() user: JwtPayload) {
    return this.userService.getMyCourses(user.sub);
  }

  // ─── LESSONS ──────────────────────────────────────────────

  @ApiOperation({ summary: 'Get single lesson content' })
  @ApiParam({ name: 'uuid', description: 'Lesson UUID' })
  @ApiResponse({ status: 200, description: 'Lesson content', type: LessonLearnResponse })
  @ApiResponse({ status: 403, description: 'Not enrolled in parent course or lesson locked', type: ErrorResponse })
  @ApiResponse({ status: 404, description: 'Lesson not found', type: ErrorResponse })
  @Get('lessons/:uuid')
  getSingleLesson(
    @Param('uuid') lessonUuid: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.userService.getSingleLesson(lessonUuid, user.sub);
  }

  @ApiOperation({ summary: 'Update video watch progress for a lesson' })
  @ApiParam({ name: 'uuid', description: 'Lesson UUID' })
  @ApiResponse({ status: 200, description: 'Progress updated', type: LessonProgressResponse })
  @ApiResponse({ status: 404, description: 'Lesson not found', type: ErrorResponse })
  @Post('lessons/:uuid/progress')
  @HttpCode(HttpStatus.OK)
  updateLessonProgress(
    @Param('uuid') lessonUuid: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: LessonProgressDto,
  ) {
    return this.userService.updateLessonProgress(lessonUuid, user.sub, dto.watchedSeconds);
  }

  @ApiOperation({ summary: 'Mark a lesson as complete' })
  @ApiParam({ name: 'uuid', description: 'Lesson UUID' })
  @ApiResponse({ status: 200, description: 'Lesson marked complete', type: LessonCompleteResponse })
  @ApiResponse({ status: 403, description: 'Lesson locked', type: ErrorResponse })
  @ApiResponse({ status: 404, description: 'Lesson not found', type: ErrorResponse })
  @Post('lessons/:uuid/complete')
  @HttpCode(HttpStatus.OK)
  completeLesson(
    @Param('uuid') lessonUuid: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.userService.completeLesson(lessonUuid, user.sub);
  }

  // ─── CERTIFICATE ──────────────────────────────────────────

  @ApiOperation({ summary: 'Get course completion certificate' })
  @ApiParam({ name: 'uuid', description: 'Course UUID' })
  @ApiResponse({ status: 200, description: 'Certificate data', type: CertificateResponse })
  @ApiResponse({ status: 400, description: 'Course not completed yet', type: ErrorResponse })
  @ApiResponse({ status: 403, description: 'Course not completed', type: ErrorResponse })
  @ApiResponse({ status: 404, description: 'Enrollment not found', type: ErrorResponse })
  @Get('courses/:uuid/certificate')
  getCertificate(
    @Param('uuid') courseUuid: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.userService.getCertificate(courseUuid, user.sub);
  }
}
