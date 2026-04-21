import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  IVideoProvider,
  VIDEO_PROVIDER_TOKEN,
  VideoAnalyticsResult,
  VideoHeatmapResult,
} from '../common/video/video-provider.interface.js';

// ─── Response types ───────────────────────────────────────────────────────────

interface StepVideoAnalytics {
  views: number;
  avgWatchPercent: number;
  completionRate: number;
  totalWatchTimeSeconds: number;
  provider: string;
  engagementScore: number | null;
  countryWatchTime: Record<string, number> | null;
  averageWatchTime: number | null;
}

interface StepNsiData {
  progressRecords: number;
  completedCount: number;
  dropOffCount: number;
}

interface FunnelStepResult {
  stepUuid: string;
  title: string;
  order: number;
  type: string;
  bunnyVideoId: string | null;
  videoAnalytics: StepVideoAnalytics | null;
  nsiData: StepNsiData;
}

export interface FunnelVideoAnalyticsResponse {
  summary: {
    totalFunnelViews: number;
    avgCompletionRate: number;
    totalDropOffs: number;
    bestPerformingStep: FunnelStepResult | null;
    worstPerformingStep: FunnelStepResult | null;
  };
  steps: FunnelStepResult[];
}

interface CourseRow {
  courseUuid: string;
  title: string;
  isPublished: boolean;
  enrollments: number;
  completions: number;
  completionRate: number;
  certificatesIssued: number;
  totalLessons: number;
  avgLessonCompletionRate: number;
  totalVideoWatchTimeSeconds: number;
  provider: 'bunny' | 'direct';
}

export interface LmsVideoSummaryResponse {
  summary: {
    totalCourses: number;
    totalEnrollments: number;
    avgCourseCompletionRate: number;
    totalCertificatesIssued: number;
    totalVideoWatchTimeSeconds: number;
  };
  courses: CourseRow[];
}

interface LessonRow {
  lessonUuid: string;
  title: string;
  order: number;
  sectionTitle: string;
  bunnyVideoId: string | null;
  nsiData: {
    startedCount: number;
    completedCount: number;
    completionRate: number;
    avgProgressPercent: number;
    dataSource: 'nsi_db';
  };
  videoAnalytics: {
    views: number;
    avgWatchPercent: number;
    totalWatchTimeSeconds: number;
    provider: string;
    dataSource: 'bunny_stream';
    engagementScore: number | null;
    countryWatchTime: Record<string, number> | null;
    averageWatchTime: number | null;
  } | null;
}

export interface CourseVideoAnalyticsResponse {
  course: {
    uuid: string;
    title: string;
    enrollments: number;
    completions: number;
    completionRate: number;
    certificatesIssued: number;
    avgProgressPercent: number;
    totalVideoWatchTimeSeconds: number;
  };
  lessons: LessonRow[];
}

interface ProgressDistribution {
  '0-25': number;
  '25-50': number;
  '50-75': number;
  '75-100': number;
}

export interface LessonVideoAnalyticsResponse {
  lesson: {
    uuid: string;
    title: string;
    videoDuration: number | null;
    bunnyVideoId: string | null;
  };
  nsiData: {
    startedCount: number;
    completedCount: number;
    completionRate: number;
    avgProgressPercent: number;
    progressDistribution: ProgressDistribution;
    dataSource: 'nsi_db';
  };
  videoAnalytics: {
    views: number;
    avgWatchPercent: number;
    totalWatchTimeSeconds: number;
    topCountries: Record<string, number>;
    provider: string;
    dataSource: 'bunny_stream';
    engagementScore: number | null;
    countryWatchTime: Record<string, number> | null;
    averageWatchTime: number | null;
  } | null;
  heatmap: {
    videoId: string;
    heatmap: number[];
    provider: string;
  } | null;
}

interface PreviewCourseRow {
  courseUuid: string;
  title: string;
  previewBunnyVideoId: string | null;
  previewAnalytics: {
    views: number;
    avgWatchPercent: number;
    provider: string;
    engagementScore: number | null;
    countryWatchTime: Record<string, number> | null;
    averageWatchTime: number | null;
  } | null;
  nsiData: {
    previewViews: number;
    enrollments: number;
    conversionRate: number | null;
  };
}

export interface CoursePreviewAnalyticsResponse {
  courses: PreviewCourseRow[];
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class VideoAnalyticsService {
  private readonly logger = new Logger(VideoAnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(VIDEO_PROVIDER_TOKEN) private readonly videoProvider: IVideoProvider,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  // ── Helper: safe Bunny analytics call (returns zeros on failure) ──────────

  private async safeGetAnalytics(
    videoId: string,
  ): Promise<VideoAnalyticsResult | null> {
    const cacheKey = `bunny:analytics:${videoId}`;
    const cached = await this.cacheManager.get<VideoAnalyticsResult>(cacheKey);
    if (cached) return cached;

    try {
      const result = await this.videoProvider.getVideoAnalytics(videoId);
      await this.cacheManager.set(cacheKey, result, 900000); // 15 mins
      return result;
    } catch (err) {
      this.logger.warn(
        `getVideoAnalytics failed for ${videoId}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  private async safeGetHeatmap(
    videoId: string,
  ): Promise<VideoHeatmapResult | null> {
    const cacheKey = `bunny:heatmap:${videoId}`;
    const cached = await this.cacheManager.get<VideoHeatmapResult>(cacheKey);
    if (cached) return cached;

    try {
      const result = await this.videoProvider.getVideoHeatmap(videoId);
      await this.cacheManager.set(cacheKey, result, 900000); // 15 mins
      return result;
    } catch (err) {
      this.logger.warn(
        `getVideoHeatmap failed for ${videoId}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  // ── Method 1: getFunnelVideoAnalytics ────────────────────────────────────

  async getFunnelVideoAnalytics(): Promise<FunnelVideoAnalyticsResponse> {
    // 1. Fetch all VIDEO_TEXT funnel steps with their content
    const steps = await this.prisma.funnelStep.findMany({
      where: { type: 'VIDEO_TEXT' },
      include: { content: true },
      orderBy: { order: 'asc' },
    });

    // 2. Fetch Bunny analytics for all steps that have a bunnyVideoId — in parallel
    const stepsWithBunny = steps.filter((s) => s.content?.bunnyVideoId);
    const analyticsResults = await Promise.all(
      stepsWithBunny.map((s) =>
        this.safeGetAnalytics(s.content!.bunnyVideoId!),
      ),
    );

    // Build lookup: bunnyVideoId → analytics result
    const analyticsMap = new Map<string, VideoAnalyticsResult | null>();
    stepsWithBunny.forEach((s, i) => {
      analyticsMap.set(s.content!.bunnyVideoId!, analyticsResults[i]);
    });

    // 3. Fetch NSI step progress data efficiently via groupBy
    const [progressCounts, completedCounts] = await Promise.all([
      this.prisma.stepProgress.groupBy({
        by: ['stepUuid'],
        _count: { uuid: true },
      }),
      this.prisma.stepProgress.groupBy({
        by: ['stepUuid'],
        where: { isCompleted: true },
        _count: { uuid: true },
      }),
    ]);

    const progressMap = new Map<string, number>();
    progressCounts.forEach((r) => progressMap.set(r.stepUuid, r._count.uuid));

    const completedMap = new Map<string, number>();
    completedCounts.forEach((r) =>
      completedMap.set(r.stepUuid, r._count.uuid),
    );

    // 4. Build step results
    const stepResults: FunnelStepResult[] = steps.map((step) => {
      const bunnyId = step.content?.bunnyVideoId ?? null;
      const analytics = bunnyId ? analyticsMap.get(bunnyId) ?? null : null;

      const progressRecords = progressMap.get(step.uuid) ?? 0;
      const completedCount = completedMap.get(step.uuid) ?? 0;
      const dropOffCount = progressRecords - completedCount;

      return {
        stepUuid: step.uuid,
        title: step.content?.title ?? '(untitled)',
        order: step.order,
        type: step.type,
        bunnyVideoId: bunnyId,
        videoAnalytics: analytics
          ? {
              views: analytics.views,
              avgWatchPercent: analytics.avgWatchPercent,
              completionRate: analytics.completionRate,
              totalWatchTimeSeconds: analytics.totalWatchTimeSeconds,
              provider: analytics.provider,
              engagementScore: analytics.engagementScore,
              countryWatchTime: analytics.countryWatchTime,
              averageWatchTime: analytics.averageWatchTime,
            }
          : null,
        nsiData: { progressRecords, completedCount, dropOffCount },
      };
    });

    // 5. Build summary
    const stepsWithAnalytics = stepResults.filter((s) => s.videoAnalytics);
    const totalFunnelViews = stepsWithAnalytics.reduce(
      (sum, s) => sum + (s.videoAnalytics?.views ?? 0),
      0,
    );
    const avgCompletionRate =
      stepsWithAnalytics.length > 0
        ? stepsWithAnalytics.reduce(
            (sum, s) => sum + (s.videoAnalytics?.completionRate ?? 0),
            0,
          ) / stepsWithAnalytics.length
        : 0;
    const totalDropOffs = stepResults.reduce(
      (sum, s) => sum + s.nsiData.dropOffCount,
      0,
    );

    let bestPerformingStep: FunnelStepResult | null = null;
    let worstPerformingStep: FunnelStepResult | null = null;

    if (stepsWithAnalytics.length === 1) {
      bestPerformingStep = stepsWithAnalytics[0];
      worstPerformingStep = null;
    } else if (stepsWithAnalytics.length > 1) {
      bestPerformingStep = stepsWithAnalytics.reduce((best, s) =>
        (s.videoAnalytics?.completionRate ?? 0) >
        (best.videoAnalytics?.completionRate ?? 0)
          ? s
          : best,
      );
      worstPerformingStep = stepsWithAnalytics.reduce((worst, s) =>
        (s.videoAnalytics?.completionRate ?? 0) <
        (worst.videoAnalytics?.completionRate ?? 0)
          ? s
          : worst,
      );
      // If all steps share the same completion rate, best=first, worst=null
      if (bestPerformingStep.stepUuid === worstPerformingStep.stepUuid) {
        worstPerformingStep = null;
      }
    }

    return {
      summary: {
        totalFunnelViews,
        avgCompletionRate: Math.round(avgCompletionRate * 10) / 10,
        totalDropOffs,
        bestPerformingStep,
        worstPerformingStep,
      },
      steps: stepResults,
    };
  }

  // ── Method 2: getLmsVideoSummary ─────────────────────────────────────────

  async getLmsVideoSummary(): Promise<LmsVideoSummaryResponse> {
    // 1. Fetch all published courses with sections/lessons
    const courses = await this.prisma.course.findMany({
      where: { isPublished: true },
      include: {
        sections: {
          include: {
            lessons: {
              select: { uuid: true, bunnyVideoId: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const courseUuids = courses.map((c) => c.uuid);

    // 2. Batch queries for enrollment/completion/certificate/lesson data
    const [enrollmentGroups, completionGroups, certGroups] = await Promise.all([
      this.prisma.courseEnrollment.groupBy({
        by: ['courseUuid'],
        where: { courseUuid: { in: courseUuids } },
        _count: { uuid: true },
      }),
      this.prisma.courseEnrollment.groupBy({
        by: ['courseUuid'],
        where: {
          courseUuid: { in: courseUuids },
          completedAt: { not: null },
        },
        _count: { uuid: true },
      }),
      this.prisma.courseEnrollment.groupBy({
        by: ['courseUuid'],
        where: {
          courseUuid: { in: courseUuids },
          certificateUrl: { not: null },
        },
        _count: { uuid: true },
      }),
    ]);

    const enrollMap = new Map<string, number>();
    enrollmentGroups.forEach((r) =>
      enrollMap.set(r.courseUuid, r._count.uuid),
    );

    const completionMap = new Map<string, number>();
    completionGroups.forEach((r) =>
      completionMap.set(r.courseUuid, r._count.uuid),
    );

    const certMap = new Map<string, number>();
    certGroups.forEach((r) => certMap.set(r.courseUuid, r._count.uuid));

    // 3. Compute avgLessonCompletionRate per course from LessonProgress
    // Gather all lesson UUIDs grouped by course
    const lessonUuidsByCourse = new Map<string, string[]>();
    for (const course of courses) {
      const uuids = course.sections.flatMap((s) => s.lessons.map((l) => l.uuid));
      lessonUuidsByCourse.set(course.uuid, uuids);
    }

    const allLessonUuids = courses.flatMap((c) =>
      c.sections.flatMap((s) => s.lessons.map((l) => l.uuid)),
    );

    const [lessonStartGroups, lessonCompleteGroups, watchSumGroups] = await Promise.all([
      allLessonUuids.length > 0
        ? this.prisma.lessonProgress.groupBy({
            by: ['lessonUuid'],
            where: { lessonUuid: { in: allLessonUuids } },
            _count: { uuid: true },
          })
        : Promise.resolve([]),
      allLessonUuids.length > 0
        ? this.prisma.lessonProgress.groupBy({
            by: ['lessonUuid'],
            where: {
              lessonUuid: { in: allLessonUuids },
              isCompleted: true,
            },
            _count: { uuid: true },
          })
        : Promise.resolve([]),
      // Sum watchedSeconds per lesson to compute totalVideoWatchTimeSeconds per course
      allLessonUuids.length > 0
        ? this.prisma.lessonProgress.groupBy({
            by: ['lessonUuid'],
            where: { lessonUuid: { in: allLessonUuids } },
            _sum: { watchedSeconds: true },
          })
        : Promise.resolve([]),
    ]);

    const lessonStartMap = new Map<string, number>();
    lessonStartGroups.forEach((r) =>
      lessonStartMap.set(r.lessonUuid, r._count.uuid),
    );

    const lessonCompleteMap = new Map<string, number>();
    lessonCompleteGroups.forEach((r) =>
      lessonCompleteMap.set(r.lessonUuid, r._count.uuid),
    );

    // Sum of watchedSeconds per lesson — used for totalVideoWatchTimeSeconds
    const lessonWatchSumMap = new Map<string, number>();
    watchSumGroups.forEach((r) =>
      lessonWatchSumMap.set(r.lessonUuid, r._sum.watchedSeconds ?? 0),
    );

    // 4. Build course rows
    const courseRows: CourseRow[] = courses.map((course) => {
      const allLessons = course.sections.flatMap((s) => s.lessons);
      const enrollments = enrollMap.get(course.uuid) ?? 0;
      const completions = completionMap.get(course.uuid) ?? 0;
      const certificatesIssued = certMap.get(course.uuid) ?? 0;
      const totalLessons = allLessons.length;

      const completionRate =
        enrollments > 0
          ? Math.round((completions / enrollments) * 100 * 10) / 10
          : 0;

      // avgLessonCompletionRate: per lesson completion rate averaged
      const lessonUuids = lessonUuidsByCourse.get(course.uuid) ?? [];
      const lessonRates = lessonUuids.map((luuid) => {
        const started = lessonStartMap.get(luuid) ?? 0;
        const completed = lessonCompleteMap.get(luuid) ?? 0;
        return started > 0 ? (completed / started) * 100 : 0;
      });
      const avgLessonCompletionRate =
        lessonRates.length > 0
          ? Math.round(
              (lessonRates.reduce((a, b) => a + b, 0) / lessonRates.length) *
                10,
            ) / 10
          : 0;

      const hasBunny = allLessons.some((l) => l.bunnyVideoId != null);

      // Sum watched seconds across all lessons in this course
      const totalVideoWatchTimeSeconds = lessonUuids.reduce(
        (sum, luuid) => sum + (lessonWatchSumMap.get(luuid) ?? 0),
        0,
      );

      return {
        courseUuid: course.uuid,
        title: course.title,
        isPublished: course.isPublished,
        enrollments,
        completions,
        completionRate,
        certificatesIssued,
        totalLessons,
        avgLessonCompletionRate,
        totalVideoWatchTimeSeconds,
        provider: hasBunny ? 'bunny' : 'direct',
      };
    });

    const totalEnrollments = courseRows.reduce(
      (sum, c) => sum + c.enrollments,
      0,
    );
    const totalCertificatesIssued = courseRows.reduce(
      (sum, c) => sum + c.certificatesIssued,
      0,
    );
    const avgCourseCompletionRate =
      courseRows.length > 0
        ? Math.round(
            (courseRows.reduce((sum, c) => sum + c.completionRate, 0) /
              courseRows.length) *
              10,
          ) / 10
        : 0;

    const totalVideoWatchTimeSeconds = courseRows.reduce(
      (sum, c) => sum + c.totalVideoWatchTimeSeconds,
      0,
    );

    return {
      summary: {
        totalCourses: courseRows.length,
        totalEnrollments,
        avgCourseCompletionRate,
        totalCertificatesIssued,
        totalVideoWatchTimeSeconds,
      },
      courses: courseRows,
    };
  }

  // ── Method 3: getCourseVideoAnalytics ────────────────────────────────────

  async getCourseVideoAnalytics(
    courseUuid: string,
  ): Promise<CourseVideoAnalyticsResponse> {
    // 1. Find course
    const course = await this.prisma.course.findUnique({
      where: { uuid: courseUuid },
    });
    if (!course) throw new NotFoundException('Course not found');

    // 2. Fetch all lessons with their section title
    const sections = await this.prisma.courseSection.findMany({
      where: { courseUuid },
      include: {
        lessons: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    });

    const lessons = sections.flatMap((s) =>
      s.lessons.map((l) => ({ ...l, sectionTitle: s.title })),
    );
    const lessonUuids = lessons.map((l) => l.uuid);

    // 3. Fetch NSI lesson progress data in parallel with Bunny analytics
    const [startGroups, completeGroups, watchGroups, watchSumGroupsCourse] = await Promise.all([
      lessonUuids.length > 0
        ? this.prisma.lessonProgress.groupBy({
            by: ['lessonUuid'],
            where: { lessonUuid: { in: lessonUuids } },
            _count: { uuid: true },
          })
        : Promise.resolve([]),
      lessonUuids.length > 0
        ? this.prisma.lessonProgress.groupBy({
            by: ['lessonUuid'],
            where: { lessonUuid: { in: lessonUuids }, isCompleted: true },
            _count: { uuid: true },
          })
        : Promise.resolve([]),
      lessonUuids.length > 0
        ? this.prisma.lessonProgress.groupBy({
            by: ['lessonUuid'],
            where: { lessonUuid: { in: lessonUuids } },
            _avg: { watchedSeconds: true },
          })
        : Promise.resolve([]),
      // Sum watchedSeconds per lesson for totalVideoWatchTimeSeconds
      lessonUuids.length > 0
        ? this.prisma.lessonProgress.groupBy({
            by: ['lessonUuid'],
            where: { lessonUuid: { in: lessonUuids } },
            _sum: { watchedSeconds: true },
          })
        : Promise.resolve([]),
    ]);

    const startMap = new Map<string, number>();
    startGroups.forEach((r) => startMap.set(r.lessonUuid, r._count.uuid));

    const completeMap = new Map<string, number>();
    completeGroups.forEach((r) => completeMap.set(r.lessonUuid, r._count.uuid));

    const watchAvgMap = new Map<string, number>();
    watchGroups.forEach((r) =>
      watchAvgMap.set(r.lessonUuid, r._avg.watchedSeconds ?? 0),
    );

    const watchSumMapCourse = new Map<string, number>();
    watchSumGroupsCourse.forEach((r) =>
      watchSumMapCourse.set(r.lessonUuid, r._sum.watchedSeconds ?? 0),
    );

    // 4. Fetch Bunny analytics for lessons with bunnyVideoId — in parallel
    const lessonsWithBunny = lessons.filter((l) => l.bunnyVideoId);
    const bunnyAnalyticsResults = await Promise.all(
      lessonsWithBunny.map((l) =>
        this.videoProvider
          .getVideoAnalytics(l.bunnyVideoId!)
          .catch(() => null),
      ),
    );

    const bunnyMap = new Map<string, VideoAnalyticsResult | null>();
    lessonsWithBunny.forEach((l, i) => {
      bunnyMap.set(l.bunnyVideoId!, bunnyAnalyticsResults[i]);
    });

    // 5. Build lesson rows
    const lessonRows: LessonRow[] = lessons.map((lesson) => {
      const startedCount = startMap.get(lesson.uuid) ?? 0;
      const completedCount = completeMap.get(lesson.uuid) ?? 0;
      const completionRate =
        startedCount > 0
          ? Math.round((completedCount / startedCount) * 100 * 10) / 10
          : 0;

      const avgWatchedSec = watchAvgMap.get(lesson.uuid) ?? 0;
      const avgProgressPercent =
        lesson.videoDuration && lesson.videoDuration > 0
          ? Math.round((avgWatchedSec / lesson.videoDuration) * 100 * 10) / 10
          : 0;

      const analytics = lesson.bunnyVideoId
        ? (bunnyMap.get(lesson.bunnyVideoId) ?? null)
        : null;

      return {
        lessonUuid: lesson.uuid,
        title: lesson.title,
        order: lesson.order,
        sectionTitle: lesson.sectionTitle,
        bunnyVideoId: lesson.bunnyVideoId ?? null,
        nsiData: { startedCount, completedCount, completionRate, avgProgressPercent, dataSource: 'nsi_db' as const },
        videoAnalytics: analytics
          ? {
              views: analytics.views,
              avgWatchPercent: analytics.avgWatchPercent,
              totalWatchTimeSeconds: analytics.totalWatchTimeSeconds,
              provider: analytics.provider,
              dataSource: 'bunny_stream' as const,
              engagementScore: analytics.engagementScore,
              countryWatchTime: analytics.countryWatchTime,
              averageWatchTime: analytics.averageWatchTime,
            }
          : null,
      };
    });

    // 6. Course-level NSI data
    const [enrollments, completions, certificatesIssued] = await Promise.all([
      this.prisma.courseEnrollment.count({ where: { courseUuid } }),
      this.prisma.courseEnrollment.count({
        where: { courseUuid, completedAt: { not: null } },
      }),
      this.prisma.courseEnrollment.count({
        where: { courseUuid, certificateUrl: { not: null } },
      }),
    ]);

    const completionRate =
      enrollments > 0
        ? Math.round((completions / enrollments) * 100 * 10) / 10
        : 0;

    // Course-level avgProgressPercent: average of per-lesson progress percentages
    // for lessons that have a known videoDuration. Uses watchedSeconds / videoDuration.
    const lessonsWithDuration = lessons.filter(
      (l) => l.videoDuration && l.videoDuration > 0,
    );
    const avgProgressPercent =
      lessonsWithDuration.length > 0
        ? Math.round(
            (lessonsWithDuration.reduce((sum, l) => {
              const avgWatchedSec = watchAvgMap.get(l.uuid) ?? 0;
              return sum + (avgWatchedSec / l.videoDuration!) * 100;
            }, 0) /
              lessonsWithDuration.length) *
              10,
          ) / 10
        : 0;

    // totalVideoWatchTimeSeconds: sum of all watchedSeconds across all lesson progress records
    const totalVideoWatchTimeSeconds = lessonUuids.reduce(
      (sum, luuid) => sum + (watchSumMapCourse.get(luuid) ?? 0),
      0,
    );

    return {
      course: {
        uuid: course.uuid,
        title: course.title,
        enrollments,
        completions,
        completionRate,
        certificatesIssued,
        avgProgressPercent,
        totalVideoWatchTimeSeconds,
      },
      lessons: lessonRows,
    };
  }

  // ── Method 4: getLessonVideoAnalytics ────────────────────────────────────

  async getLessonVideoAnalytics(
    courseUuid: string,
    lessonUuid: string,
  ): Promise<LessonVideoAnalyticsResponse> {
    // 1. Find lesson and verify it belongs to this course
    const lesson = await this.prisma.courseLesson.findUnique({
      where: { uuid: lessonUuid },
      include: { section: { select: { courseUuid: true } } },
    });

    if (!lesson) throw new NotFoundException('Lesson not found');
    if (lesson.section.courseUuid !== courseUuid) {
      throw new NotFoundException('Lesson not found in this course');
    }

    // 2. Fetch NSI progress data
    const [startedCount, completedCount, allProgress] = await Promise.all([
      this.prisma.lessonProgress.count({ where: { lessonUuid } }),
      this.prisma.lessonProgress.count({
        where: { lessonUuid, isCompleted: true },
      }),
      this.prisma.lessonProgress.findMany({
        where: { lessonUuid },
        select: { watchedSeconds: true },
      }),
    ]);

    const completionRate =
      startedCount > 0
        ? Math.round((completedCount / startedCount) * 100 * 10) / 10
        : 0;

    const avgWatchedSec =
      allProgress.length > 0
        ? allProgress.reduce((sum, p) => sum + p.watchedSeconds, 0) /
          allProgress.length
        : 0;

    const avgProgressPercent =
      lesson.videoDuration && lesson.videoDuration > 0
        ? Math.round((avgWatchedSec / lesson.videoDuration) * 100 * 10) / 10
        : 0;

    // 3. Build progress distribution buckets
    const distribution: ProgressDistribution = {
      '0-25': 0,
      '25-50': 0,
      '50-75': 0,
      '75-100': 0,
    };

    if (lesson.videoDuration && lesson.videoDuration > 0) {
      for (const p of allProgress) {
        const pct = (p.watchedSeconds / lesson.videoDuration) * 100;
        if (pct < 25) distribution['0-25']++;
        else if (pct < 50) distribution['25-50']++;
        else if (pct < 75) distribution['50-75']++;
        else distribution['75-100']++;
      }
    } else {
      // No duration — all records go to 0-25
      distribution['0-25'] = allProgress.length;
    }

    // 4. Fetch Bunny analytics + heatmap in parallel (if bunnyVideoId set)
    let videoAnalytics: LessonVideoAnalyticsResponse['videoAnalytics'] = null;
    let heatmap: LessonVideoAnalyticsResponse['heatmap'] = null;

    if (lesson.bunnyVideoId) {
      const [analytics, heatmapResult] = await Promise.all([
        this.safeGetAnalytics(lesson.bunnyVideoId),
        this.safeGetHeatmap(lesson.bunnyVideoId),
      ]);

      if (analytics) {
        videoAnalytics = {
          views: analytics.views,
          avgWatchPercent: analytics.avgWatchPercent,
          totalWatchTimeSeconds: analytics.totalWatchTimeSeconds,
          topCountries: analytics.topCountries,
          provider: analytics.provider,
          dataSource: 'bunny_stream',
          engagementScore: analytics.engagementScore,
          countryWatchTime: analytics.countryWatchTime,
          averageWatchTime: analytics.averageWatchTime,
        };
      }

      if (heatmapResult) {
        heatmap = heatmapResult;
      }
    }

    return {
      lesson: {
        uuid: lesson.uuid,
        title: lesson.title,
        videoDuration: lesson.videoDuration ?? null,
        bunnyVideoId: lesson.bunnyVideoId ?? null,
      },
      nsiData: {
        startedCount,
        completedCount,
        completionRate,
        avgProgressPercent,
        progressDistribution: distribution,
        dataSource: 'nsi_db',
      },
      videoAnalytics,
      heatmap,
    };
  }

  // ── Method 5: getCoursePreviewAnalytics ──────────────────────────────────

  async getCoursePreviewAnalytics(): Promise<CoursePreviewAnalyticsResponse> {
    // 1. Fetch all published courses with preview info
    const courses = await this.prisma.course.findMany({
      where: { isPublished: true },
      select: {
        uuid: true,
        title: true,
        previewBunnyVideoId: true,
        _count: { select: { enrollments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 2. Fetch Bunny preview analytics for all courses that have previewBunnyVideoId — in parallel
    const coursesWithPreview = courses.filter((c) => c.previewBunnyVideoId);
    const previewAnalyticsResults = await Promise.all(
      coursesWithPreview.map((c) =>
        this.safeGetAnalytics(c.previewBunnyVideoId!),
      ),
    );

    const previewMap = new Map<string, VideoAnalyticsResult | null>();
    coursesWithPreview.forEach((c, i) => {
      previewMap.set(c.previewBunnyVideoId!, previewAnalyticsResults[i]);
    });

    // 3. Build course rows
    const courseRows: PreviewCourseRow[] = courses.map((course) => {
      const enrollments = course._count.enrollments;
      const bunnyId = course.previewBunnyVideoId ?? null;
      const analytics = bunnyId ? (previewMap.get(bunnyId) ?? null) : null;

      const previewViews = analytics && analytics.views > 0 ? analytics.views : 0;
      const conversionRate =
        previewViews > 0
          ? Math.round((enrollments / previewViews) * 100 * 10) / 10
          : null;

      return {
        courseUuid: course.uuid,
        title: course.title,
        previewBunnyVideoId: bunnyId,
        previewAnalytics: analytics
          ? {
              views: analytics.views,
              avgWatchPercent: analytics.avgWatchPercent,
              provider: analytics.provider,
              engagementScore: analytics.engagementScore,
              countryWatchTime: analytics.countryWatchTime,
              averageWatchTime: analytics.averageWatchTime,
            }
          : null,
        nsiData: {
          previewViews,
          enrollments,
          conversionRate,
        },
      };
    });

    return { courses: courseRows };
  }
}
