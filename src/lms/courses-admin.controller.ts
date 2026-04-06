import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
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

/**
 * CoursesAdminController — all admin LMS routes.
 * All routes require JWT + RolesGuard(SUPER_ADMIN).
 */
@Controller({ path: 'admin', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class CoursesAdminController {
  constructor(private readonly adminService: CoursesAdminService) {}

  // ─── COURSES ──────────────────────────────────────────────

  @Post('courses')
  @HttpCode(HttpStatus.CREATED)
  createCourse(@Body() dto: CreateCourseDto) {
    return this.adminService.createCourse(dto);
  }

  @Get('courses')
  findAllCourses() {
    return this.adminService.findAllCourses();
  }

  @Get('courses/:uuid')
  findOneCourse(@Param('uuid') uuid: string) {
    return this.adminService.findOneCourse(uuid);
  }

  @Get('courses/:uuid/edit')
  findOneCourseForUpdate(@Param('uuid') uuid: string) {
    return this.adminService.findCourseForUpdate(uuid);
  }

  @Patch('courses/:uuid')
  updateCourse(@Param('uuid') uuid: string, @Body() dto: UpdateCourseDto) {
    return this.adminService.updateCourse(uuid, dto);
  }

  @Delete('courses/:uuid')
  deleteCourse(@Param('uuid') uuid: string) {
    return this.adminService.deleteCourse(uuid);
  }

  @Patch('courses/:uuid/publish')
  publishCourse(@Param('uuid') uuid: string) {
    return this.adminService.publishCourse(uuid);
  }

  @Patch('courses/:uuid/unpublish')
  unpublishCourse(@Param('uuid') uuid: string) {
    return this.adminService.unpublishCourse(uuid);
  }

  // ─── SECTIONS ─────────────────────────────────────────────

  @Post('courses/:uuid/sections')
  @HttpCode(HttpStatus.CREATED)
  createSection(@Param('uuid') courseUuid: string, @Body() dto: CreateSectionDto) {
    return this.adminService.createSection(courseUuid, dto);
  }

  @Patch('courses/:courseUuid/sections/reorder')
  reorderSections(@Param('courseUuid') courseUuid: string, @Body() dto: ReorderDto) {
    return this.adminService.reorderSections(courseUuid, dto.orderedUuids);
  }

  @Get('courses/:courseUuid/sections/:sectionUuid/edit')
  findOneSectionForUpdate(
    @Param('courseUuid') courseUuid: string,
    @Param('sectionUuid') sectionUuid: string,
  ) {
    return this.adminService.findSectionForUpdate(courseUuid, sectionUuid);
  }

  @Patch('courses/:courseUuid/sections/:sectionUuid')
  updateSection(
    @Param('courseUuid') courseUuid: string,
    @Param('sectionUuid') sectionUuid: string,
    @Body() dto: UpdateSectionDto,
  ) {
    return this.adminService.updateSection(courseUuid, sectionUuid, dto);
  }

  @Delete('courses/:courseUuid/sections/:sectionUuid')
  deleteSection(
    @Param('courseUuid') courseUuid: string,
    @Param('sectionUuid') sectionUuid: string,
  ) {
    return this.adminService.deleteSection(courseUuid, sectionUuid);
  }

  // ─── LESSONS ──────────────────────────────────────────────

  @Post('courses/:courseUuid/sections/:sectionUuid/lessons')
  @HttpCode(HttpStatus.CREATED)
  createLesson(
    @Param('courseUuid') courseUuid: string,
    @Param('sectionUuid') sectionUuid: string,
    @Body() dto: CreateLessonDto,
  ) {
    return this.adminService.createLesson(courseUuid, sectionUuid, dto);
  }

  @Patch('courses/:courseUuid/sections/:sectionUuid/lessons/reorder')
  reorderLessons(
    @Param('courseUuid') courseUuid: string,
    @Param('sectionUuid') sectionUuid: string,
    @Body() dto: ReorderDto,
  ) {
    return this.adminService.reorderLessons(courseUuid, sectionUuid, dto.orderedUuids);
  }

  @Get('courses/:courseUuid/sections/:sectionUuid/lessons/:lessonUuid/edit')
  findOneLessonForUpdate(
    @Param('courseUuid') courseUuid: string,
    @Param('sectionUuid') sectionUuid: string,
    @Param('lessonUuid') lessonUuid: string,
  ) {
    return this.adminService.findLessonForUpdate(courseUuid, sectionUuid, lessonUuid);
  }

  @Patch('courses/:courseUuid/sections/:sectionUuid/lessons/:lessonUuid')
  updateLesson(
    @Param('courseUuid') courseUuid: string,
    @Param('sectionUuid') sectionUuid: string,
    @Param('lessonUuid') lessonUuid: string,
    @Body() dto: UpdateLessonDto,
  ) {
    return this.adminService.updateLesson(courseUuid, sectionUuid, lessonUuid, dto);
  }

  @Delete('courses/:courseUuid/sections/:sectionUuid/lessons/:lessonUuid')
  deleteLesson(
    @Param('courseUuid') courseUuid: string,
    @Param('sectionUuid') sectionUuid: string,
    @Param('lessonUuid') lessonUuid: string,
  ) {
    return this.adminService.deleteLesson(courseUuid, sectionUuid, lessonUuid);
  }

  // ─── ANALYTICS ────────────────────────────────────────────

  @Get('lms/analytics')
  getLmsAnalytics() {
    return this.adminService.getAnalytics();
  }
}
