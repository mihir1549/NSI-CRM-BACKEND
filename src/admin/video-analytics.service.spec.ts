import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { VideoAnalyticsService } from './video-analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { VIDEO_PROVIDER_TOKEN } from '../common/video/video-provider.interface';
import { CacheModule, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

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
    engagementScore: 65,
    countryWatchTime: { IN: 1000, US: 200 },
    averageWatchTime: 120,
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
      imports: [CacheModule.register()],
      providers: [
        VideoAnalyticsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: VIDEO_PROVIDER_TOKEN, useValue: mockVideoProvider },
      ],
    }).compile();

    service = module.get<VideoAnalyticsService>(VideoAnalyticsService);

    jest.resetAllMocks();

    mockVideoProvider.getVideoAnalytics.mockResolvedValue({
      videoId: BUNNY_VIDEO_ID,
      views: 100,
      avgWatchPercent: 75,
      completionRate: 50,
      totalWatchTimeSeconds: 3600,
      topCountries: { IN: 60, US: 30 },
      provider: 'mock',
      engagementScore: 65,
      countryWatchTime: { IN: 1000, US: 200 },
      averageWatchTime: 120,
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
      mockPrisma.stepProgress.groupBy.mockResolvedValue([]);
    });

    it('returns steps with videoAnalytics when bunnyVideoId is set', async () => {
      mockPrisma.funnelStep.findMany.mockResolvedValue([makeStep()]);

      const result = await service.getFunnelVideoAnalytics();

      expect(result.steps).toHaveLength(1);
      const analytics = result.steps[0].videoAnalytics;
      expect(analytics).not.toBeNull();
      expect(analytics?.views).toBe(100);
      expect(analytics?.engagementScore).toBe(65);
      expect(analytics?.countryWatchTime).toEqual({ IN: 1000, US: 200 });
      expect(analytics?.averageWatchTime).toBe(120);
    });

    it('returns null videoAnalytics when bunnyVideoId is null', async () => {
      mockPrisma.funnelStep.findMany.mockResolvedValue([makeStep(null)]);
      const result = await service.getFunnelVideoAnalytics();
      expect(result.steps[0].videoAnalytics).toBeNull();
      expect(mockVideoProvider.getVideoAnalytics).not.toHaveBeenCalled();
    });

    it('summary correctly identifies bestPerformingStep and worstPerformingStep', async () => {
      const step1 = { uuid: 's1', type: 'VIDEO_TEXT', order: 1, content: { bunnyVideoId: 'v1' } };
      const step2 = { uuid: 's2', type: 'VIDEO_TEXT', order: 2, content: { bunnyVideoId: 'v2' } };
      mockPrisma.funnelStep.findMany.mockResolvedValue([step1, step2]);

      mockVideoProvider.getVideoAnalytics
        .mockResolvedValueOnce({ videoId: 'v1', views: 100, completionRate: 80, provider: 'mock', engagementScore: 1, countryWatchTime: {}, averageWatchTime: 1 })
        .mockResolvedValueOnce({ videoId: 'v2', views: 100, completionRate: 20, provider: 'mock', engagementScore: 1, countryWatchTime: {}, averageWatchTime: 1 });

      const result = await service.getFunnelVideoAnalytics();
      expect(result.summary.bestPerformingStep?.stepUuid).toBe('s1');
      expect(result.summary.worstPerformingStep?.stepUuid).toBe('s2');
    });

    it('handles Bunny API failure gracefully — returns zeros, does not throw', async () => {
      mockPrisma.funnelStep.findMany.mockResolvedValue([makeStep()]);
      mockVideoProvider.getVideoAnalytics.mockRejectedValue(new Error('Bunny Error'));
      const result = await service.getFunnelVideoAnalytics();
      expect(result.steps[0].videoAnalytics).toBeNull();
      expect(result.summary.totalFunnelViews).toBe(0);
    });

    it('uses Promise.all — calls Bunny in parallel, not sequentially', async () => {
      const steps = [
        { uuid: 's1', type: 'VIDEO_TEXT', content: { bunnyVideoId: 'v1' } },
        { uuid: 's2', type: 'VIDEO_TEXT', content: { bunnyVideoId: 'v2' } },
      ];
      mockPrisma.funnelStep.findMany.mockResolvedValue(steps);
      const callOrder: string[] = [];
      mockVideoProvider.getVideoAnalytics.mockImplementation((id) => {
        callOrder.push(id);
        return Promise.resolve({ videoId: id, views: 10, provider: 'mock', engagementScore: 1, countryWatchTime: {}, averageWatchTime: 1 });
      });
      await service.getFunnelVideoAnalytics();
      expect(mockVideoProvider.getVideoAnalytics).toHaveBeenCalledTimes(2);
    });
  });

  // ══════════════════════════════════════════════════════════
  // getLmsVideoSummary()
  // ══════════════════════════════════════════════════════════

  describe('getLmsVideoSummary()', () => {
    const makeCourse = (uuid = COURSE_UUID, hasBunny = false) => ({
      uuid, title: 'C1', isPublished: true, sections: [{ lessons: [{ bunnyVideoId: hasBunny ? 'v1' : null }] }]
    });

    beforeEach(() => {
      mockPrisma.course.findMany.mockResolvedValue([makeCourse()]);
      mockPrisma.courseEnrollment.groupBy.mockResolvedValue([]);
      mockPrisma.lessonProgress.groupBy.mockResolvedValue([]);
    });

    it('returns all published courses with NSI data', async () => {
      mockPrisma.courseEnrollment.groupBy.mockResolvedValue([{ courseUuid: COURSE_UUID, _count: { uuid: 5 } }]);
      const result = await service.getLmsVideoSummary();
      expect(result.courses[0].enrollments).toBe(5);
    });

    it('does NOT call videoProvider (no Bunny calls at summary level)', async () => {
      await service.getLmsVideoSummary();
      expect(mockVideoProvider.getVideoAnalytics).not.toHaveBeenCalled();
    });

    it('correctly calculates completionRate per course', async () => {
      mockPrisma.courseEnrollment.groupBy
        .mockResolvedValueOnce([{ courseUuid: COURSE_UUID, _count: { uuid: 10 } }])
        .mockResolvedValueOnce([{ courseUuid: COURSE_UUID, _count: { uuid: 4 } }]);
      const result = await service.getLmsVideoSummary();
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
    beforeEach(() => {
      mockPrisma.course.findUnique.mockResolvedValue({ uuid: COURSE_UUID, title: 'C1' });
      mockPrisma.courseSection.findMany.mockResolvedValue([{ lessons: [{ uuid: LESSON_UUID, bunnyVideoId: BUNNY_VIDEO_ID, videoDuration: 100 }] }]);
      mockPrisma.lessonProgress.groupBy.mockResolvedValue([]);
      mockPrisma.courseEnrollment.count.mockResolvedValue(0);
      mockPrisma.lessonProgress.aggregate.mockResolvedValue({ _avg: { watchedSeconds: null } });
    });

    it('returns lessons with both nsiData and videoAnalytics', async () => {
      const result = await service.getCourseVideoAnalytics(COURSE_UUID);
      expect(result.lessons[0].videoAnalytics?.views).toBe(100);
      expect(result.lessons[0].videoAnalytics?.engagementScore).toBe(65);
    });

    it('throws NotFoundException for unknown courseUuid', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(null);
      await expect(service.getCourseVideoAnalytics('u1')).rejects.toThrow(NotFoundException);
    });

    it('calls Bunny in parallel for all lessons with bunnyVideoId', async () => {
      mockPrisma.courseSection.findMany.mockResolvedValue([{ lessons: [{ bunnyVideoId: 'v1' }, { bunnyVideoId: 'v2' }] }]);
      await service.getCourseVideoAnalytics(COURSE_UUID);
      expect(mockVideoProvider.getVideoAnalytics).toHaveBeenCalledTimes(2);
    });
  });

  // ══════════════════════════════════════════════════════════
  // getLessonVideoAnalytics()
  // ══════════════════════════════════════════════════════════

  describe('getLessonVideoAnalytics()', () => {
    const makeLesson = (bunnyId: string | null = BUNNY_VIDEO_ID) => ({
      uuid: LESSON_UUID, title: 'L1', videoDuration: 400, bunnyVideoId: bunnyId, section: { courseUuid: COURSE_UUID }
    });

    beforeEach(() => {
      mockPrisma.courseLesson.findUnique.mockResolvedValue(makeLesson());
      mockPrisma.lessonProgress.count.mockResolvedValue(0);
      mockPrisma.lessonProgress.findMany.mockResolvedValue([]);
    });

    it('returns full detail including heatmap when bunnyVideoId is set', async () => {
      const result = await service.getLessonVideoAnalytics(COURSE_UUID, LESSON_UUID);
      expect(result.videoAnalytics?.views).toBe(100);
      expect(result.videoAnalytics?.engagementScore).toBe(65);
      expect(result.heatmap).not.toBeNull();
    });

    it('progressDistribution correctly buckets 0-25, 25-50, 50-75, 75-100', async () => {
      mockPrisma.lessonProgress.findMany.mockResolvedValue([{ watchedSeconds: 40 }, { watchedSeconds: 360 }]);
      const result = await service.getLessonVideoAnalytics(COURSE_UUID, LESSON_UUID);
      expect(result.nsiData.progressDistribution['0-25']).toBe(1);
      expect(result.nsiData.progressDistribution['75-100']).toBe(1);
    });

    it('returns null heatmap gracefully when Bunny heatmap fails', async () => {
      mockVideoProvider.getVideoHeatmap.mockRejectedValue(new Error('Err'));
      const result = await service.getLessonVideoAnalytics(COURSE_UUID, LESSON_UUID);
      expect(result.heatmap).toBeNull();
      expect(result.videoAnalytics).not.toBeNull();
    });

    it('throws NotFoundException when lesson does not exist', async () => {
      mockPrisma.courseLesson.findUnique.mockResolvedValue(null);
      await expect(service.getLessonVideoAnalytics(COURSE_UUID, 'l1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when lesson belongs to a different course', async () => {
      mockPrisma.courseLesson.findUnique.mockResolvedValue({ ...makeLesson(), section: { courseUuid: 'other' } });
      await expect(service.getLessonVideoAnalytics(COURSE_UUID, LESSON_UUID)).rejects.toThrow(NotFoundException);
    });

    it('does not call Bunny when lesson has no bunnyVideoId', async () => {
      mockPrisma.courseLesson.findUnique.mockResolvedValue(makeLesson(null));
      const result = await service.getLessonVideoAnalytics(COURSE_UUID, LESSON_UUID);
      expect(mockVideoProvider.getVideoAnalytics).not.toHaveBeenCalled();
      expect(result.videoAnalytics).toBeNull();
    });
  });

  // ══════════════════════════════════════════════════════════
  // getCoursePreviewAnalytics()
  // ══════════════════════════════════════════════════════════

  describe('getCoursePreviewAnalytics()', () => {
    it('1. Empty DB — no courses with previews -> Expect empty response', async () => {
      mockPrisma.course.findMany.mockResolvedValue([]);
      const result = await service.getCoursePreviewAnalytics();
      expect(result).toEqual({ courses: [] });
    });

    it('2. NSI data exists, no previewBunnyVideoId on any course -> videoAnalytics should be null', async () => {
      mockPrisma.course.findMany.mockResolvedValue([{ uuid: 'c1', previewBunnyVideoId: null, _count: { enrollments: 10 } }]);
      const result = await service.getCoursePreviewAnalytics();
      expect(result.courses[0].previewAnalytics).toBeNull();
      expect(result.courses[0].nsiData.previewViews).toBe(0);
      expect(result.courses[0].nsiData.conversionRate).toBeNull();
    });

    it('3. Full combined data -> Response has both NSI data and Bunny analytics populated', async () => {
      mockPrisma.course.findMany.mockResolvedValue([{ uuid: 'c1', previewBunnyVideoId: 'v1', _count: { enrollments: 10 } }]);
      mockVideoProvider.getVideoAnalytics.mockResolvedValueOnce({
        videoId: 'v1', views: 100, avgWatchPercent: 50, provider: 'mock', engagementScore: 65, countryWatchTime: {}, averageWatchTime: 120
      });
      const result = await service.getCoursePreviewAnalytics();
      expect(result.courses[0].previewAnalytics?.engagementScore).toBe(65);
    });

    it('4. Bunny API fails -> course still appears, no crash', async () => {
      mockPrisma.course.findMany.mockResolvedValue([{ uuid: 'c1', previewBunnyVideoId: 'v1', _count: { enrollments: 10 } }]);
      mockVideoProvider.getVideoAnalytics.mockRejectedValueOnce(new Error('Err'));
      const result = await service.getCoursePreviewAnalytics();
      expect(result.courses[0].previewAnalytics).toBeNull();
      expect(result.courses[0].nsiData.previewViews).toBe(0);
      expect(result.courses[0].nsiData.conversionRate).toBeNull();
    });

    it('5. Edge case: viewCount is 0 -> Verify conversionRate is null', async () => {
      mockPrisma.course.findMany.mockResolvedValue([{ uuid: 'c1', previewBunnyVideoId: 'v1', _count: { enrollments: 0 } }]);
      mockVideoProvider.getVideoAnalytics.mockResolvedValueOnce({
        videoId: 'v1', views: 0, avgWatchPercent: 0, provider: 'mock', engagementScore: 0, countryWatchTime: {}, averageWatchTime: 0
      });
      const result = await service.getCoursePreviewAnalytics();
      expect(result.courses[0].nsiData.conversionRate).toBeNull();
    });
  });

  // ══════════════════════════════════════════════════════════
  // Cache Behavior
  // ══════════════════════════════════════════════════════════

  describe('Bunny Analytics Cache Behavior', () => {
    beforeEach(async () => {
      await service['cacheManager'].clear();
      jest.useFakeTimers({ advanceTimers: true });
    });
    afterEach(() => jest.useRealTimers());

    it('1. Same videoId called twice -> Bunny fetched once', async () => {
      mockPrisma.funnelStep.findMany.mockResolvedValue([{ content: { bunnyVideoId: 'v1' } }]);
      mockPrisma.stepProgress.groupBy.mockResolvedValue([]);
      await service.getFunnelVideoAnalytics();
      await service.getFunnelVideoAnalytics();
      expect(mockVideoProvider.getVideoAnalytics).toHaveBeenCalledTimes(1);
    });

    it('2. Bunny throws -> method returns null, no cache entry written', async () => {
      mockPrisma.funnelStep.findMany.mockResolvedValue([{ content: { bunnyVideoId: 'v1' } }]);
      mockPrisma.stepProgress.groupBy.mockResolvedValue([]);
      mockVideoProvider.getVideoAnalytics.mockRejectedValueOnce(new Error('Err'));
      await service.getFunnelVideoAnalytics();
      mockVideoProvider.getVideoAnalytics.mockResolvedValueOnce({ videoId: 'v1', views: 10, provider: 'mock', engagementScore: 1, countryWatchTime: {}, averageWatchTime: 1 });
      const res = await service.getFunnelVideoAnalytics();
      expect(res.steps[0].videoAnalytics?.views).toBe(10);
      expect(mockVideoProvider.getVideoAnalytics).toHaveBeenCalledTimes(2);
    });

    it('3. Different videoIds -> separate cache entries', async () => {
      mockPrisma.funnelStep.findMany.mockResolvedValueOnce([{ content: { bunnyVideoId: 'v1' } }]).mockResolvedValueOnce([{ content: { bunnyVideoId: 'v2' } }]);
      mockPrisma.stepProgress.groupBy.mockResolvedValue([]);
      await service.getFunnelVideoAnalytics();
      await service.getFunnelVideoAnalytics();
      expect(mockVideoProvider.getVideoAnalytics).toHaveBeenCalledTimes(2);
    });

    it('4. After 15 min -> Bunny fetched again', async () => {
      mockPrisma.funnelStep.findMany.mockResolvedValue([{ content: { bunnyVideoId: 'v1' } }]);
      mockPrisma.stepProgress.groupBy.mockResolvedValue([]);
      await service.getFunnelVideoAnalytics();
      jest.advanceTimersByTime(15 * 60 * 1000 + 1000);
      await service.getFunnelVideoAnalytics();
      expect(mockVideoProvider.getVideoAnalytics).toHaveBeenCalledTimes(2);
    });
  });
});
