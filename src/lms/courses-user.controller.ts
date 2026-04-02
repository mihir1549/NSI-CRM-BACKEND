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

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';
import { CoursesUserService } from './courses-user.service.js';
import { EnrollmentService } from './enrollment.service.js';
import { LessonProgressDto } from './dto/lesson-progress.dto.js';

/**
 * CoursesUserController — user-facing LMS routes.
 * All routes require JWT + RolesGuard(CUSTOMER, DISTRIBUTOR).
 */
@Controller({ path: 'lms', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CUSTOMER', 'DISTRIBUTOR')
export class CoursesUserController {
  constructor(
    private readonly userService: CoursesUserService,
    private readonly enrollmentService: EnrollmentService,
  ) {}

  // ─── BROWSE COURSES ───────────────────────────────────────

  @Get('courses')
  findAllCourses(@CurrentUser() user: JwtPayload) {
    return this.userService.findAllPublished(user.sub);
  }

  @Get('courses/:uuid')
  findOneCourse(
    @Param('uuid') courseUuid: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.userService.findOneCourse(courseUuid, user.sub);
  }

  // ─── ENROLLMENT ───────────────────────────────────────────

  @Post('courses/:uuid/enroll')
  @HttpCode(HttpStatus.OK)
  enrollCourse(
    @Param('uuid') courseUuid: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.enrollmentService.enroll(user.sub, courseUuid);
  }

  @Get('courses/:uuid/learn')
  getCourseLearnContent(
    @Param('uuid') courseUuid: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.userService.getCourseLearnContent(courseUuid, user.sub);
  }

  @Get('my-courses')
  getMyCourses(@CurrentUser() user: JwtPayload) {
    return this.userService.getMyCourses(user.sub);
  }

  // ─── LESSONS ──────────────────────────────────────────────

  @Get('lessons/:uuid')
  getSingleLesson(
    @Param('uuid') lessonUuid: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.userService.getSingleLesson(lessonUuid, user.sub);
  }

  @Post('lessons/:uuid/progress')
  @HttpCode(HttpStatus.OK)
  updateLessonProgress(
    @Param('uuid') lessonUuid: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: LessonProgressDto,
  ) {
    return this.userService.updateLessonProgress(lessonUuid, user.sub, dto.watchedSeconds);
  }

  @Post('lessons/:uuid/complete')
  @HttpCode(HttpStatus.OK)
  completeLesson(
    @Param('uuid') lessonUuid: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.userService.completeLesson(lessonUuid, user.sub);
  }

  // ─── CERTIFICATE ──────────────────────────────────────────

  @Get('courses/:uuid/certificate')
  getCertificate(
    @Param('uuid') courseUuid: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.userService.getCertificate(courseUuid, user.sub);
  }
}
