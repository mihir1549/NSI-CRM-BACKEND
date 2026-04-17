import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { VideoAnalyticsService } from './video-analytics.service.js';

/**
 * VideoAnalyticsController — SUPER_ADMIN video analytics routes.
 *
 * Route order matters here: specific routes (/lms-videos, /course-previews,
 * /funnel-videos) must be declared before parameterised routes.
 */
@ApiTags('Video Analytics')
@ApiBearerAuth('access-token')
@Controller({ path: 'admin/analytics', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class VideoAnalyticsController {
  constructor(
    private readonly videoAnalyticsService: VideoAnalyticsService,
  ) {}

  /**
   * GET /api/v1/admin/analytics/funnel-videos
   * Funnel VIDEO_TEXT steps: Bunny analytics + NSI completion data.
   */
  @ApiOperation({
    summary: 'Funnel video performance — overall + per step',
  })
  @Get('funnel-videos')
  getFunnelVideoAnalytics() {
    return this.videoAnalyticsService.getFunnelVideoAnalytics();
  }

  /**
   * GET /api/v1/admin/analytics/lms-videos
   * LMS video summary across all published courses (no Bunny calls here).
   */
  @ApiOperation({
    summary: 'LMS video summary across all courses',
  })
  @Get('lms-videos')
  getLmsVideoSummary() {
    return this.videoAnalyticsService.getLmsVideoSummary();
  }

  /**
   * GET /api/v1/admin/analytics/course-previews
   * Course preview video conversion analytics.
   */
  @ApiOperation({
    summary: 'Course preview video conversion analytics',
  })
  @Get('course-previews')
  getCoursePreviewAnalytics() {
    return this.videoAnalyticsService.getCoursePreviewAnalytics();
  }

  /**
   * GET /api/v1/admin/analytics/lms-videos/:courseUuid
   * Course video analytics — NSI + Bunny combined (per lesson).
   */
  @ApiOperation({
    summary: 'Course video analytics — NSI + Bunny combined',
  })
  @ApiParam({ name: 'courseUuid', description: 'Course UUID' })
  @Get('lms-videos/:courseUuid')
  getCourseVideoAnalytics(@Param('courseUuid') courseUuid: string) {
    return this.videoAnalyticsService.getCourseVideoAnalytics(courseUuid);
  }

  /**
   * GET /api/v1/admin/analytics/lms-videos/:courseUuid/lessons/:lessonUuid
   * Lesson detail — NSI data + Bunny analytics + heatmap.
   */
  @ApiOperation({
    summary: 'Lesson detail — NSI data + Bunny analytics + heatmap',
  })
  @ApiParam({ name: 'courseUuid', description: 'Course UUID' })
  @ApiParam({ name: 'lessonUuid', description: 'Lesson UUID' })
  @Get('lms-videos/:courseUuid/lessons/:lessonUuid')
  getLessonVideoAnalytics(
    @Param('courseUuid') courseUuid: string,
    @Param('lessonUuid') lessonUuid: string,
  ) {
    return this.videoAnalyticsService.getLessonVideoAnalytics(
      courseUuid,
      lessonUuid,
    );
  }
}
