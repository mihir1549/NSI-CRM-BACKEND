import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CoursesAdminService } from './courses-admin.service.js';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';
import { CreateSectionDto } from './dto/create-section.dto.js';
import { UpdateSectionDto } from './dto/update-section.dto.js';
import { CreateLessonDto } from './dto/create-lesson.dto.js';
import { UpdateLessonDto } from './dto/update-lesson.dto.js';
import { ReorderDto } from './dto/reorder.dto.js';
import {
  CourseAdminListResponse,
  CourseAdminDetailResponse,
  CourseAdminUpdateResponse,
  SectionAdminUpdateResponse,
  LessonAdminUpdateResponse,
  LmsAnalyticsResponse,
} from './dto/responses/lms-admin.responses.js';
import {
  ErrorResponse,
  DeletedResponse,
  ReorderedResponse,
} from '../common/dto/responses/error.response.js';

/**
 * CoursesAdminController — all admin LMS routes.
 * All routes require JWT + RolesGuard(SUPER_ADMIN).
 */
@ApiTags('LMS - Admin')
@ApiBearerAuth('access-token')
@Controller({ path: 'admin', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class CoursesAdminController {
  constructor(private readonly adminService: CoursesAdminService) {}

  // ─── COURSES ──────────────────────────────────────────────

  @ApiOperation({ summary: 'Create a new course' })
  @ApiResponse({
    status: 201,
    description: 'Course created',
    schema: { type: 'object', properties: { uuid: { type: 'string' } } },
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error',
    type: ErrorResponse,
  })
  @Post('courses')
  @HttpCode(HttpStatus.CREATED)
  createCourse(@Body() dto: CreateCourseDto) {
    return this.adminService.createCourse(dto);
  }

  @ApiOperation({ summary: 'List all courses (admin view)' })
  @ApiResponse({
    status: 200,
    description: 'List of all courses',
    type: [CourseAdminListResponse],
  })
  @Get('courses')
  findAllCourses() {
    return this.adminService.findAllCourses();
  }

  @ApiOperation({ summary: 'Get course detail (admin view)' })
  @ApiParam({ name: 'uuid', description: 'Course UUID' })
  @ApiResponse({
    status: 200,
    description: 'Course detail',
    type: CourseAdminDetailResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'Course not found',
    type: ErrorResponse,
  })
  @Get('courses/:uuid')
  findOneCourse(@Param('uuid', new ParseUUIDPipe()) uuid: string) {
    return this.adminService.findOneCourse(uuid);
  }

  @ApiOperation({ summary: 'Get course data for editing' })
  @ApiParam({ name: 'uuid', description: 'Course UUID' })
  @ApiResponse({
    status: 200,
    description: 'Course edit data',
    type: CourseAdminUpdateResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'Course not found',
    type: ErrorResponse,
  })
  @Get('courses/:uuid/edit')
  findOneCourseForUpdate(@Param('uuid', new ParseUUIDPipe()) uuid: string) {
    return this.adminService.findCourseForUpdate(uuid);
  }

  @ApiOperation({ summary: 'Update course fields' })
  @ApiParam({ name: 'uuid', description: 'Course UUID' })
  @ApiResponse({
    status: 200,
    description: 'Course updated',
    schema: { type: 'object', properties: { uuid: { type: 'string' } } },
  })
  @ApiResponse({
    status: 404,
    description: 'Course not found',
    type: ErrorResponse,
  })
  @Patch('courses/:uuid')
  updateCourse(
    @Param('uuid', new ParseUUIDPipe()) uuid: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.adminService.updateCourse(uuid, dto);
  }

  @ApiOperation({ summary: 'Delete a course' })
  @ApiParam({ name: 'uuid', description: 'Course UUID' })
  @ApiResponse({
    status: 200,
    description: 'Course deleted',
    type: DeletedResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete course with active enrollments',
    type: ErrorResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'Course not found',
    type: ErrorResponse,
  })
  @Delete('courses/:uuid')
  deleteCourse(@Param('uuid', new ParseUUIDPipe()) uuid: string) {
    return this.adminService.deleteCourse(uuid);
  }

  @ApiOperation({ summary: 'Publish a course' })
  @ApiParam({ name: 'uuid', description: 'Course UUID' })
  @ApiResponse({
    status: 200,
    description: 'Course published',
    schema: { type: 'object', properties: { uuid: { type: 'string' } } },
  })
  @ApiResponse({
    status: 404,
    description: 'Course not found',
    type: ErrorResponse,
  })
  @Patch('courses/:uuid/publish')
  publishCourse(@Param('uuid', new ParseUUIDPipe()) uuid: string) {
    return this.adminService.publishCourse(uuid);
  }

  @ApiOperation({ summary: 'Unpublish a course' })
  @ApiParam({ name: 'uuid', description: 'Course UUID' })
  @ApiResponse({
    status: 200,
    description: 'Course unpublished',
    schema: { type: 'object', properties: { uuid: { type: 'string' } } },
  })
  @ApiResponse({
    status: 404,
    description: 'Course not found',
    type: ErrorResponse,
  })
  @Patch('courses/:uuid/unpublish')
  unpublishCourse(@Param('uuid', new ParseUUIDPipe()) uuid: string) {
    return this.adminService.unpublishCourse(uuid);
  }

  // ─── SECTIONS ─────────────────────────────────────────────

  @ApiOperation({ summary: 'Create a section in a course' })
  @ApiParam({ name: 'uuid', description: 'Course UUID' })
  @ApiResponse({
    status: 201,
    description: 'Section created',
    schema: { type: 'object', properties: { uuid: { type: 'string' } } },
  })
  @ApiResponse({
    status: 404,
    description: 'Course not found',
    type: ErrorResponse,
  })
  @Post('courses/:uuid/sections')
  @HttpCode(HttpStatus.CREATED)
  createSection(
    @Param('uuid') courseUuid: string,
    @Body() dto: CreateSectionDto,
  ) {
    return this.adminService.createSection(courseUuid, dto);
  }

  @ApiOperation({ summary: 'Reorder sections in a course' })
  @ApiParam({ name: 'courseUuid', description: 'Course UUID' })
  @ApiResponse({
    status: 200,
    description: 'Sections reordered',
    type: ReorderedResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'Course not found',
    type: ErrorResponse,
  })
  @Patch('courses/:courseUuid/sections/reorder')
  reorderSections(
    @Param('courseUuid') courseUuid: string,
    @Body() dto: ReorderDto,
  ) {
    return this.adminService.reorderSections(courseUuid, dto.orderedUuids);
  }

  @ApiOperation({ summary: 'Get section data for editing' })
  @ApiParam({ name: 'courseUuid', description: 'Course UUID' })
  @ApiParam({ name: 'sectionUuid', description: 'Section UUID' })
  @ApiResponse({
    status: 200,
    description: 'Section edit data',
    type: SectionAdminUpdateResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'Section not found',
    type: ErrorResponse,
  })
  @Get('courses/:courseUuid/sections/:sectionUuid/edit')
  findOneSectionForUpdate(
    @Param('courseUuid') courseUuid: string,
    @Param('sectionUuid') sectionUuid: string,
  ) {
    return this.adminService.findSectionForUpdate(courseUuid, sectionUuid);
  }

  @ApiOperation({ summary: 'Update a section' })
  @ApiParam({ name: 'courseUuid', description: 'Course UUID' })
  @ApiParam({ name: 'sectionUuid', description: 'Section UUID' })
  @ApiResponse({
    status: 200,
    description: 'Section updated',
    schema: { type: 'object', properties: { uuid: { type: 'string' } } },
  })
  @ApiResponse({
    status: 404,
    description: 'Section not found',
    type: ErrorResponse,
  })
  @Patch('courses/:courseUuid/sections/:sectionUuid')
  updateSection(
    @Param('courseUuid') courseUuid: string,
    @Param('sectionUuid') sectionUuid: string,
    @Body() dto: UpdateSectionDto,
  ) {
    return this.adminService.updateSection(courseUuid, sectionUuid, dto);
  }

  @ApiOperation({ summary: 'Delete a section' })
  @ApiParam({ name: 'courseUuid', description: 'Course UUID' })
  @ApiParam({ name: 'sectionUuid', description: 'Section UUID' })
  @ApiResponse({
    status: 200,
    description: 'Section deleted',
    type: DeletedResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'Section not found',
    type: ErrorResponse,
  })
  @Delete('courses/:courseUuid/sections/:sectionUuid')
  deleteSection(
    @Param('courseUuid') courseUuid: string,
    @Param('sectionUuid') sectionUuid: string,
  ) {
    return this.adminService.deleteSection(courseUuid, sectionUuid);
  }

  // ─── LESSONS ──────────────────────────────────────────────

  @ApiOperation({ summary: 'Create a lesson in a section' })
  @ApiParam({ name: 'courseUuid', description: 'Course UUID' })
  @ApiParam({ name: 'sectionUuid', description: 'Section UUID' })
  @ApiResponse({
    status: 201,
    description: 'Lesson created',
    schema: { type: 'object', properties: { uuid: { type: 'string' } } },
  })
  @ApiResponse({
    status: 404,
    description: 'Section not found',
    type: ErrorResponse,
  })
  @Post('courses/:courseUuid/sections/:sectionUuid/lessons')
  @HttpCode(HttpStatus.CREATED)
  createLesson(
    @Param('courseUuid') courseUuid: string,
    @Param('sectionUuid') sectionUuid: string,
    @Body() dto: CreateLessonDto,
  ) {
    return this.adminService.createLesson(courseUuid, sectionUuid, dto);
  }

  @ApiOperation({ summary: 'Reorder lessons in a section' })
  @ApiParam({ name: 'courseUuid', description: 'Course UUID' })
  @ApiParam({ name: 'sectionUuid', description: 'Section UUID' })
  @ApiResponse({
    status: 200,
    description: 'Lessons reordered',
    type: ReorderedResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'Section not found',
    type: ErrorResponse,
  })
  @Patch('courses/:courseUuid/sections/:sectionUuid/lessons/reorder')
  reorderLessons(
    @Param('courseUuid') courseUuid: string,
    @Param('sectionUuid') sectionUuid: string,
    @Body() dto: ReorderDto,
  ) {
    return this.adminService.reorderLessons(
      courseUuid,
      sectionUuid,
      dto.orderedUuids,
    );
  }

  @ApiOperation({ summary: 'Get lesson data for editing' })
  @ApiParam({ name: 'courseUuid', description: 'Course UUID' })
  @ApiParam({ name: 'sectionUuid', description: 'Section UUID' })
  @ApiParam({ name: 'lessonUuid', description: 'Lesson UUID' })
  @ApiResponse({
    status: 200,
    description: 'Lesson edit data',
    type: LessonAdminUpdateResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'Lesson not found',
    type: ErrorResponse,
  })
  @Get('courses/:courseUuid/sections/:sectionUuid/lessons/:lessonUuid/edit')
  findOneLessonForUpdate(
    @Param('courseUuid') courseUuid: string,
    @Param('sectionUuid') sectionUuid: string,
    @Param('lessonUuid') lessonUuid: string,
  ) {
    return this.adminService.findLessonForUpdate(
      courseUuid,
      sectionUuid,
      lessonUuid,
    );
  }

  @ApiOperation({ summary: 'Update a lesson' })
  @ApiParam({ name: 'courseUuid', description: 'Course UUID' })
  @ApiParam({ name: 'sectionUuid', description: 'Section UUID' })
  @ApiParam({ name: 'lessonUuid', description: 'Lesson UUID' })
  @ApiResponse({
    status: 200,
    description: 'Lesson updated',
    schema: { type: 'object', properties: { uuid: { type: 'string' } } },
  })
  @ApiResponse({
    status: 404,
    description: 'Lesson not found',
    type: ErrorResponse,
  })
  @Patch('courses/:courseUuid/sections/:sectionUuid/lessons/:lessonUuid')
  updateLesson(
    @Param('courseUuid') courseUuid: string,
    @Param('sectionUuid') sectionUuid: string,
    @Param('lessonUuid') lessonUuid: string,
    @Body() dto: UpdateLessonDto,
  ) {
    return this.adminService.updateLesson(
      courseUuid,
      sectionUuid,
      lessonUuid,
      dto,
    );
  }

  @ApiOperation({ summary: 'Delete a lesson' })
  @ApiParam({ name: 'courseUuid', description: 'Course UUID' })
  @ApiParam({ name: 'sectionUuid', description: 'Section UUID' })
  @ApiParam({ name: 'lessonUuid', description: 'Lesson UUID' })
  @ApiResponse({
    status: 200,
    description: 'Lesson deleted',
    type: DeletedResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'Lesson not found',
    type: ErrorResponse,
  })
  @Delete('courses/:courseUuid/sections/:sectionUuid/lessons/:lessonUuid')
  deleteLesson(
    @Param('courseUuid') courseUuid: string,
    @Param('sectionUuid') sectionUuid: string,
    @Param('lessonUuid') lessonUuid: string,
  ) {
    return this.adminService.deleteLesson(courseUuid, sectionUuid, lessonUuid);
  }

  // ─── ANALYTICS ────────────────────────────────────────────

  @ApiOperation({ summary: 'Get LMS analytics overview' })
  @ApiResponse({
    status: 200,
    description: 'LMS analytics data',
    type: LmsAnalyticsResponse,
  })
  @Get('lms/analytics')
  getLmsAnalytics() {
    return this.adminService.getAnalytics();
  }
}
