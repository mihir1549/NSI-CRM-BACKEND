import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { VideoAnalyticsService } from './video-analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { VIDEO_PROVIDER_TOKEN } from '../common/video/video-provider.interface';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const COURSE_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const LESSON_UUID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const BUNNY_VIDEO_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const STEP_UUID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

// ─── Mock: PrismaService ──────────────────────────────────────────────────────

const mockPrisma = {
  funnelStep: { findMany: jest.fn() },
  stepProgress: { groupBy: jest.fn(), count: jest.fn() },
  course: { findMany: jest.fn(), findUnique: jest.fn() },
  courseSection: { findMany: jest.fn() },
  courseEnrollment: { groupBy: jest.fn(), count: jest.fn(), aggregate: jest.fn() },
  courseLesson: { findUnique: jest.fn() },
  lessonProgress: {
    groupBy: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
    aggregate: jest.fn(),
  },
};

// ─── Mock: IVideoProvider ─────────────────────────────────────────────────────

const mockVideoProvider = {
  getVideoAnalytics: jest.fn().mockResolvedValue({
    videoId: BUNNY_VIDEO_ID,
    views: 100,
    avgWatchPercent: 75,
    completionRate: 50,
    totalWatchTimeSeconds: 3600,
    topCountries: { IN: 60, US: 30 },
    provider: 'mock',
  }),
  getVideoHeatmap: jest.fn().mockResolvedValue({
    videoId: BUNNY_VIDEO_ID,
    heatmap: [1.0, 0.9, 0.8, 0.7, 0.6],
    provider: 'mock',
  }),
  getSignedUrl: jest
    .fn()
    .mockReturnValue(`https://mock-cdn.example.com/${BUNNY_VIDEO_ID}/play_720p.mp4`),
};

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('VideoAnalyticsService', () => {
  let service: VideoAnalyticsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VideoAnalyticsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: VIDEO_PROVIDER_TOKEN, useValue: mockVideoProvider },
      ],
    }).compile();

    service = module.get<VideoAnalyticsService>(VideoAnalyticsService);

    // clearAllMocks resets call records but NOT mock implementations.
    // resetAllMocks also resets implementations, so we use it and restore
    // the default resolved values afterwards for a predictable baseline.
    jest.resetAllMocks();

    mockVideoProvider.getVideoAnalytics.mockResolvedValue({
      videoId: BUNNY_VIDEO_ID,
      views: 100,
      avgWatchPercent: 75,
      completionRate: 50,
      totalWatchTimeSeconds: 3600,
      topCountries: { IN: 60, US: 30 },
      provider: 'mock',
    });
    mockVideoProvider.getVideoHeatmap.mockResolvedValue({
      videoId: BUNNY_VIDEO_ID,
      heatmap: [1.0, 0.9, 0.8, 0.7, 0.6],
      provider: 'mock',
    });
    mockVideoProvider.getSignedUrl.mockReturnValue(
      `https://mock-cdn.example.com/${BUNNY_VIDEO_ID}/play_720p.mp4`,
    );
  });

  // ══════════════════════════════════════════════════════════
  // getFunnelVideoAnalytics()
  // ══════════════════════════════════════════════════════════

  describe('getFunnelVideoAnalytics()', () => {
    const makeStep = (bunnyId: string | null = BUNNY_VIDEO_ID) => ({
      uuid: STEP_UUID,
      type: 'VIDEO_TEXT',
      order: 1,
      isActive: true,
      content: bunnyId
        ? { title: 'Intro Video', videoUrl: 'https://cdn.example.com', bunnyVideoId: bunnyId }
        : null,
    });

    beforeEach(() => {
      // Default: empty progress maps
      mockPrisma.stepProgress.groupBy.mockResolvedValue([]);
    });

    it('returns steps with videoAnalytics when bunnyVideoId is set', async () => {
      mockPrisma.funnelStep.findMany.mockResolvedValue([makeStep()]);

      const result = await service.getFunnelVideoAnalytics();

      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].videoAnalytics).not.toBeNull();
      expect(result.steps[0].videoAnalytics?.views).toBe(100);
      expect(result.steps[0].videoAnalytics?.provider).toBe('mock');
    });

    it('returns null videoAnalytics when bunnyVideoId is null', async () => {
      mockPrisma.funnelStep.findMany.mockResolvedValue([makeStep(null)]);

      const result = await service.getFunnelVideoAnalytics();

      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].videoAnalytics).toBeNull();
      expect(mockVideoProvider.getVideoAnalytics).not.toHaveBeenCalled();
    });

    it('summary correctly identifies bestPerformingStep and worstPerformingStep', async () => {
      const step1 = {
        uuid: 'step-1',
        type: 'VIDEO_TEXT',
        order: 1,
        isActive: true,
        content: { title: 'Step 1', videoUrl: null, bunnyVideoId: 'vid-1' },
      };
      const step2 = {
        uuid: 'step-2',
        type: 'VIDEO_TEXT',
        order: 2,
        isActive: true,
        content: { title: 'Step 2', videoUrl: null, bunnyVideoId: 'vid-2' },
      };

      mockPrisma.funnelStep.findMany.mockResolvedValue([step1, step2]);

      // vid-1 completionRate=80, vid-2 completionRate=20
      mockVideoProvider.getVideoAnalytics
        .mockResolvedValueOnce({
          videoId: 'vid-1', views: 200, avgWatchPercent: 80,
          completionRate: 80, totalWatchTimeSeconds: 7200,
          topCountries: {}, provider: 'mock',
        })
        .mockResolvedValueOnce({
          videoId: 'vid-2', views: 100, avgWatchPercent: 40,
          completionRate: 20, totalWatchTimeSeconds: 1800,
          topCountries: {}, provider: 'mock',
        });

      const result = await service.getFunnelVideoAnalytics();

      expect(result.summary.bestPerformingStep?.stepUuid).toBe('step-1');
      expect(result.summary.worstPerformingStep?.stepUuid).toBe('step-2');
      expect(result.summary.totalFunnelViews).toBe(300);
    });

    it('handles Bunny API failure gracefully — returns zeros, does not throw', async () => {
      mockPrisma.funnelStep.findMany.mockResolvedValue([makeStep()]);
      mockVideoProvider.getVideoAnalytics.mockRejectedValue(
        new Error('Bunny API unavailable'),
      );

      const result = await service.getFunnelVideoAnalytics();

      // Should not throw — videoAnalytics will be null (graceful degradation)
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].videoAnalytics).toBeNull();
      expect(result.summary.totalFunnelViews).toBe(0);
    });

    it('uses Promise.all — calls Bunny in parallel, not sequentially', async () => {
      const steps = [
        { uuid: 'step-a', type: 'VIDEO_TEXT', order: 1, isActive: true,
          content: { title: 'A', videoUrl: null, bunnyVideoId: 'vid-a' } },
        { uuid: 'step-b', type: 'VIDEO_TEXT', order: 2, isActive: true,
          content: { title: 'B', videoUrl: null, bunnyVideoId: 'vid-b' } },
        { uuid: 'step-c', type: 'VIDEO_TEXT', order: 3, isActive: true,
          content: { title: 'C', videoUrl: null, bunnyVideoId: 'vid-c' } },
      ];
      mockPrisma.funnelStep.findMany.mockResolvedValue(steps);

      const callOrder: number[] = [];
      let resolvers: Array<() => void> = [];

      mockVideoProvider.getVideoAnalytics.mockImplementation(() => {
        const idx = callOrder.length;
        callOrder.push(idx);
        return new Promise<object>((resolve) => {
          resolvers.push(() =>
            resolve({
              videoId: `vid-${idx}`, views: 10, avgWatchPercent: 50,
              completionRate: 30, totalWatchTimeSeconds: 100,
              topCountries: {}, provider: 'mock',
            }),
          );
        });
      });

      const resultPromise = service.getFunnelVideoAnalytics();

      // All three resolvers should be queued (parallel) before we resolve any
      await new Promise((r) => setTimeout(r, 0));
      expect(resolvers).toHaveLength(3); // all 3 called before any resolved
      resolvers.forEach((r) => r());

      const result = await resultPromise;
      expect(result.steps).toHaveLength(3);
    });
  });

  // ══════════════════════════════════════════════════════════
  // getLmsVideoSummary()
  // ══════════════════════════════════════════════════════════

  describe('getLmsVideoSummary()', () => {
    const makeCourse = (uuid = COURSE_UUID, hasBunny = false) => ({
      uuid,
      title: 'Test Course',
      isPublished: true,
      sections: [
        {
          uuid: 'sec-1',
          courseUuid: uuid,
          lessons: [
            { uuid: 'les-1', bunnyVideoId: hasBunny ? BUNNY_VIDEO_ID : null },
          ],
        },
      ],
    });

    beforeEach(() => {
      mockPrisma.course.findMany.mockResolvedValue([makeCourse()]);
      mockPrisma.courseEnrollment.groupBy.mockResolvedValue([]);
      mockPrisma.lessonProgress.groupBy.mockResolvedValue([]);
    });

    it('returns all published courses with NSI data', async () => {
      mockPrisma.courseEnrollment.groupBy
        .mockResolvedValueOnce([{ courseUuid: COURSE_UUID, _count: { uuid: 5 } }]) // enrollments
        .mockResolvedValueOnce([{ courseUuid: COURSE_UUID, _count: { uuid: 2 } }]) // completions
        .mockResolvedValueOnce([{ courseUuid: COURSE_UUID, _count: { uuid: 1 } }]); // certs

      const result = await service.getLmsVideoSummary();

      expect(result.courses).toHaveLength(1);
      expect(result.courses[0].enrollments).toBe(5);
      expect(result.courses[0].completions).toBe(2);
      expect(result.courses[0].certificatesIssued).toBe(1);
      expect(result.summary.totalEnrollments).toBe(5);
    });

    it('does NOT call videoProvider (no Bunny calls at summary level)', async () => {
      await service.getLmsVideoSummary();
      expect(mockVideoProvider.getVideoAnalytics).not.toHaveBeenCalled();
    });

    it('correctly calculates completionRate per course', async () => {
      mockPrisma.courseEnrollment.groupBy
        .mockResolvedValueOnce([{ courseUuid: COURSE_UUID, _count: { uuid: 10 } }]) // enrollments
        .mockResolvedValueOnce([{ courseUuid: COURSE_UUID, _count: { uuid: 4 } }])  // completions
        .mockResolvedValueOnce([]); // certs

      const result = await service.getLmsVideoSummary();

      // 4/10 * 100 = 40%
      expect(result.courses[0].completionRate).toBe(40);
    });

    it('reports provider as bunny when any lesson has bunnyVideoId', async () => {
      mockPrisma.course.findMany.mockResolvedValue([makeCourse(COURSE_UUID, true)]);

      const result = await service.getLmsVideoSummary();

      expect(result.courses[0].provider).toBe('bunny');
    });
  });

  // ══════════════════════════════════════════════════════════
  // getCourseVideoAnalytics()
  // ══════════════════════════════════════════════════════════

  describe('getCourseVideoAnalytics()', () => {
    const makeSections = () => [
      {
        uuid: 'sec-1',
        title: 'Section One',
        order: 1,
        lessons: [
          {
            uuid: LESSON_UUID,
            title: 'Lesson 1',
            order: 1,
            bunnyVideoId: BUNNY_VIDEO_ID,
            videoDuration: 300,
          },
        ],
      },
    ];

    beforeEach(() => {
      mockPrisma.course.findUnique.mockResolvedValue({
        uuid: COURSE_UUID, title: 'Test Course',
      });
      mockPrisma.courseSection.findMany.mockResolvedValue(makeSections());
      mockPrisma.lessonProgress.groupBy.mockResolvedValue([]);
      mockPrisma.courseEnrollment.count.mockResolvedValue(0);
      mockPrisma.lessonProgress.aggregate.mockResolvedValue({
        _avg: { watchedSeconds: null },
      });
    });

    it('returns lessons with both nsiData and videoAnalytics', async () => {
      mockPrisma.lessonProgress.groupBy
        .mockResolvedValueOnce([{ lessonUuid: LESSON_UUID, _count: { uuid: 10 } }]) // starts
        .mockResolvedValueOnce([{ lessonUuid: LESSON_UUID, _count: { uuid: 6 } }])  // completes
        .mockResolvedValueOnce([{ lessonUuid: LESSON_UUID, _avg: { watchedSeconds: 150 } }]); // avg

      const result = await service.getCourseVideoAnalytics(COURSE_UUID);

      expect(result.lessons).toHaveLength(1);
      expect(result.lessons[0].nsiData.startedCount).toBe(10);
      expect(result.lessons[0].nsiData.completedCount).toBe(6);
      expect(result.lessons[0].nsiData.completionRate).toBe(60);
      expect(result.lessons[0].videoAnalytics).not.toBeNull();
      expect(result.lessons[0].videoAnalytics?.views).toBe(100);
    });

    it('throws NotFoundException for unknown courseUuid', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(null);

      await expect(
        service.getCourseVideoAnalytics('unknown-uuid'),
      ).rejects.toThrow(NotFoundException);
    });

    it('calls Bunny in parallel for all lessons with bunnyVideoId', async () => {
      const sections = [
        {
          uuid: 'sec-1',
          title: 'Section',
          order: 1,
          lessons: [
            { uuid: 'les-1', title: 'L1', order: 1, bunnyVideoId: 'vid-1', videoDuration: 300 },
            { uuid: 'les-2', title: 'L2', order: 2, bunnyVideoId: 'vid-2', videoDuration: 200 },
            { uuid: 'les-3', title: 'L3', order: 3, bunnyVideoId: null, videoDuration: null },
          ],
        },
      ];
      mockPrisma.courseSection.findMany.mockResolvedValue(sections);

      await service.getCourseVideoAnalytics(COURSE_UUID);

      // Only the two lessons with bunnyVideoId should trigger Bunny calls
      expect(mockVideoProvider.getVideoAnalytics).toHaveBeenCalledTimes(2);
      expect(mockVideoProvider.getVideoAnalytics).toHaveBeenCalledWith('vid-1');
      expect(mockVideoProvider.getVideoAnalytics).toHaveBeenCalledWith('vid-2');
    });
  });

  // ══════════════════════════════════════════════════════════
  // getLessonVideoAnalytics()
  // ══════════════════════════════════════════════════════════

  describe('getLessonVideoAnalytics()', () => {
    const makeLesson = (bunnyId: string | null = BUNNY_VIDEO_ID) => ({
      uuid: LESSON_UUID,
      title: 'Test Lesson',
      videoDuration: 400,
      bunnyVideoId: bunnyId,
      section: { courseUuid: COURSE_UUID },
    });

    beforeEach(() => {
      mockPrisma.courseLesson.findUnique.mockResolvedValue(makeLesson());
      mockPrisma.lessonProgress.count.mockResolvedValue(0);
      mockPrisma.lessonProgress.findMany.mockResolvedValue([]);
    });

    it('returns full detail including heatmap when bunnyVideoId is set', async () => {
      mockPrisma.lessonProgress.count
        .mockResolvedValueOnce(5)  // startedCount
        .mockResolvedValueOnce(3); // completedCount

      const result = await service.getLessonVideoAnalytics(COURSE_UUID, LESSON_UUID);

      expect(result.videoAnalytics).not.toBeNull();
      expect(result.heatmap).not.toBeNull();
      expect(result.heatmap?.heatmap).toHaveLength(5);
      expect(result.nsiData.startedCount).toBe(5);
      expect(result.nsiData.completedCount).toBe(3);
      expect(result.nsiData.completionRate).toBe(60);
    });

    it('progressDistribution correctly buckets 0-25, 25-50, 50-75, 75-100', async () => {
      // videoDuration = 400s
      // Records at different watch positions:
      const progress = [
        { watchedSeconds: 60 },   // 15% → 0-25
        { watchedSeconds: 80 },   // 20% → 0-25
        { watchedSeconds: 140 },  // 35% → 25-50
        { watchedSeconds: 240 },  // 60% → 50-75
        { watchedSeconds: 360 },  // 90% → 75-100
        { watchedSeconds: 400 },  // 100% → 75-100
      ];
      mockPrisma.lessonProgress.findMany.mockResolvedValue(progress);
      mockPrisma.lessonProgress.count
        .mockResolvedValueOnce(6)
        .mockResolvedValueOnce(1);

      const result = await service.getLessonVideoAnalytics(COURSE_UUID, LESSON_UUID);

      expect(result.nsiData.progressDistribution['0-25']).toBe(2);
      expect(result.nsiData.progressDistribution['25-50']).toBe(1);
      expect(result.nsiData.progressDistribution['50-75']).toBe(1);
      expect(result.nsiData.progressDistribution['75-100']).toBe(2);
    });

    it('returns null heatmap gracefully when Bunny heatmap fails', async () => {
      mockVideoProvider.getVideoHeatmap.mockRejectedValue(
        new Error('Bunny heatmap endpoint unavailable'),
      );

      const result = await service.getLessonVideoAnalytics(COURSE_UUID, LESSON_UUID);

      // Analytics may still succeed; heatmap should be null (not throw)
      expect(result.heatmap).toBeNull();
    });

    it('throws NotFoundException when lesson does not exist', async () => {
      mockPrisma.courseLesson.findUnique.mockResolvedValue(null);

      await expect(
        service.getLessonVideoAnalytics(COURSE_UUID, 'unknown-lesson'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when lesson belongs to a different course', async () => {
      mockPrisma.courseLesson.findUnique.mockResolvedValue({
        ...makeLesson(),
        section: { courseUuid: 'different-course-uuid' },
      });

      await expect(
        service.getLessonVideoAnalytics(COURSE_UUID, LESSON_UUID),
      ).rejects.toThrow(NotFoundException);
    });

    it('does not call Bunny when lesson has no bunnyVideoId', async () => {
      mockPrisma.courseLesson.findUnique.mockResolvedValue(makeLesson(null));

      const result = await service.getLessonVideoAnalytics(COURSE_UUID, LESSON_UUID);

      expect(mockVideoProvider.getVideoAnalytics).not.toHaveBeenCalled();
      expect(mockVideoProvider.getVideoHeatmap).not.toHaveBeenCalled();
      expect(result.videoAnalytics).toBeNull();
      expect(result.heatmap).toBeNull();
    });
  });
});
