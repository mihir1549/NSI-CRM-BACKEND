import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { CoursesUserService } from './courses-user.service';
import { PrismaService } from '../prisma/prisma.service';
import { CertificateService } from './certificate.service';
import { VIDEO_PROVIDER_TOKEN } from '../common/video/video-provider.interface.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const USER_UUID = '11111111-1111-1111-1111-111111111111';
const COURSE_UUID = '22222222-2222-2222-2222-222222222222';
const SECTION_UUID = '33333333-3333-3333-3333-333333333333';
const LESSON_UUID = '44444444-4444-4444-4444-444444444444';
const ENROLLMENT_UUID = '55555555-5555-5555-5555-555555555555';

const mockLesson = {
  uuid: LESSON_UUID,
  title: 'Lesson 1',
  description: 'Intro',
  videoUrl: 'https://example.com/video.mp4',
  videoDuration: 120,
  textContent: null,
  pdfUrl: null,
  order: 1,
  isPublished: true,
  sectionUuid: SECTION_UUID,
  section: {
    uuid: SECTION_UUID,
    courseUuid: COURSE_UUID,
    order: 1,
    course: { uuid: COURSE_UUID, title: 'Test Course', isPublished: true },
  },
};

const mockSection = {
  uuid: SECTION_UUID,
  title: 'Section 1',
  order: 1,
  lessons: [
    {
      uuid: LESSON_UUID,
      title: 'Lesson 1',
      order: 1,
      videoDuration: 120,
      isPublished: true,
      sectionUuid: SECTION_UUID,
    },
  ],
  _count: { lessons: 1 },
};

const mockCourse = {
  uuid: COURSE_UUID,
  title: 'Test Course',
  description: 'A test course',
  thumbnailUrl: null,
  isFree: false,
  price: 999,
  isPublished: true,
  createdAt: new Date('2026-01-01'),
  sections: [mockSection],
};

const mockEnrollment = {
  uuid: ENROLLMENT_UUID,
  userUuid: USER_UUID,
  courseUuid: COURSE_UUID,
  enrolledAt: new Date('2026-02-01'),
  completedAt: null,
  certificateUrl: null,
  course: mockCourse,
};

// ─── Prisma mock ──────────────────────────────────────────────────────────────
const mockPrisma = {
  course: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  courseEnrollment: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  courseLesson: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  lessonProgress: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    upsert: jest.fn(),
    count: jest.fn(),
  },
};

const mockCertificateService = {
  getOrGenerate: jest.fn(),
  generateForEnrollment: jest.fn().mockResolvedValue(undefined),
};

const mockVideoProvider = {
  getSignedUrl: jest.fn().mockReturnValue('https://signed.url'),
};

describe('CoursesUserService', () => {
  let service: CoursesUserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoursesUserService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CertificateService, useValue: mockCertificateService },
        { provide: VIDEO_PROVIDER_TOKEN, useValue: mockVideoProvider },
      ],
    }).compile();

    service = module.get<CoursesUserService>(CoursesUserService);
    jest.clearAllMocks();

    // Safe defaults
    mockPrisma.course.findMany.mockResolvedValue([]);
    mockPrisma.courseEnrollment.findMany.mockResolvedValue([]);
    mockPrisma.courseEnrollment.findUnique.mockResolvedValue(null);
    mockPrisma.courseEnrollment.update.mockResolvedValue({});
    mockPrisma.courseLesson.findMany.mockResolvedValue([{ uuid: LESSON_UUID }]);
    mockPrisma.lessonProgress.findMany.mockResolvedValue([]);
    mockPrisma.lessonProgress.findUnique.mockResolvedValue(null);
    mockPrisma.lessonProgress.findFirst.mockResolvedValue(null);
    mockPrisma.lessonProgress.upsert.mockResolvedValue({
      isCompleted: false,
      watchedSeconds: 50,
    });
    mockPrisma.lessonProgress.count.mockResolvedValue(0);
    mockCertificateService.generateForEnrollment.mockResolvedValue(undefined);
  });

  // ══════════════════════════════════════════════════════════
  // findAllPublished()
  // ══════════════════════════════════════════════════════════
  describe('findAllPublished()', () => {
    it('returns published courses with enrollment status', async () => {
      mockPrisma.course.findMany.mockResolvedValue([mockCourse]);
      mockPrisma.courseEnrollment.findMany.mockResolvedValue([]);

      const result = await service.findAllPublished(USER_UUID);

      expect(result).toHaveLength(1);
      expect(result[0].uuid).toBe(COURSE_UUID);
      expect(result[0].isEnrolled).toBe(false);
      expect(result[0].progress).toBeNull();
    });

    it('marks course as enrolled with progress when user is enrolled', async () => {
      mockPrisma.course.findMany.mockResolvedValue([mockCourse]);
      mockPrisma.courseEnrollment.findMany.mockResolvedValue([
        { courseUuid: COURSE_UUID, completedAt: null },
      ]);
      mockPrisma.course.findMany
        .mockResolvedValueOnce([mockCourse])
        .mockResolvedValueOnce([
          {
            ...mockCourse,
            sections: [{ ...mockSection, lessons: [{ uuid: LESSON_UUID }] }],
          },
        ]);
      mockPrisma.lessonProgress.findMany.mockResolvedValue([]);

      const result = await service.findAllPublished(USER_UUID);

      expect(result[0].isEnrolled).toBe(true);
    });

    it('returns empty array when no published courses', async () => {
      mockPrisma.course.findMany.mockResolvedValue([]);
      mockPrisma.courseEnrollment.findMany.mockResolvedValue([]);

      const result = await service.findAllPublished(USER_UUID);

      expect(result).toHaveLength(0);
    });
  });

  // ══════════════════════════════════════════════════════════
  // findOneCourse()
  // ══════════════════════════════════════════════════════════
  describe('findOneCourse()', () => {
    it('returns course detail without enrollment for non-enrolled user', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(mockCourse);
      mockPrisma.courseEnrollment.findUnique.mockResolvedValue(null);

      const result = await service.findOneCourse(COURSE_UUID, USER_UUID);

      expect(result.uuid).toBe(COURSE_UUID);
      expect(result.enrollment).toBeNull();
    });

    it('returns course detail with progress for enrolled user', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(mockCourse);
      mockPrisma.courseEnrollment.findUnique.mockResolvedValue(mockEnrollment);
      mockPrisma.lessonProgress.findMany.mockResolvedValue([]);

      const result = await service.findOneCourse(COURSE_UUID, USER_UUID);

      expect(result.enrollment?.progress).toBe(0);
      expect(result.sections).toHaveLength(1);
    });

    it('throws NotFoundException when course not found or unpublished', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(null);

      await expect(
        service.findOneCourse(COURSE_UUID, USER_UUID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // getCourseLearnContent()
  // ══════════════════════════════════════════════════════════
  describe('getCourseLearnContent()', () => {
    it('returns full learn content for enrolled user', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(mockCourse);
      mockPrisma.courseEnrollment.findUnique.mockResolvedValue(mockEnrollment);
      mockPrisma.lessonProgress.findMany.mockResolvedValue([]);

      const result = await service.getCourseLearnContent(
        COURSE_UUID,
        USER_UUID,
      );

      expect(result.uuid).toBe(COURSE_UUID);
      expect(result.sections).toHaveLength(1);
    });

    it('throws NotFoundException when course not found', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(null);

      await expect(
        service.getCourseLearnContent(COURSE_UUID, USER_UUID),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user is not enrolled', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(mockCourse);
      mockPrisma.courseEnrollment.findUnique.mockResolvedValue(null);

      await expect(
        service.getCourseLearnContent(COURSE_UUID, USER_UUID),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // getMyCourses()
  // ══════════════════════════════════════════════════════════
  describe('getMyCourses()', () => {
    it('returns list of enrolled courses with progress', async () => {
      mockPrisma.courseEnrollment.findMany.mockResolvedValue([mockEnrollment]);
      mockPrisma.lessonProgress.count.mockResolvedValue(0);
      mockPrisma.lessonProgress.findFirst.mockResolvedValue(null);

      const result = await service.getMyCourses(USER_UUID);

      expect(result.courses).toHaveLength(1);
      expect(result.courses[0].uuid).toBe(COURSE_UUID);
      expect(result.courses[0].progress).toBe(0);
    });

    it('returns empty list when user has no enrollments', async () => {
      mockPrisma.courseEnrollment.findMany.mockResolvedValue([]);

      const result = await service.getMyCourses(USER_UUID);

      expect(result.courses).toHaveLength(0);
    });

    it('calculates correct progress percentage', async () => {
      const enrollment = {
        ...mockEnrollment,
        course: {
          ...mockCourse,
          sections: [
            {
              ...mockSection,
              lessons: [
                { uuid: LESSON_UUID },
                { uuid: '66666666-6666-6666-6666-666666666666' },
              ],
            },
          ],
        },
      };
      mockPrisma.courseEnrollment.findMany.mockResolvedValue([enrollment]);
      mockPrisma.lessonProgress.count.mockResolvedValue(1); // 1 of 2 completed
      mockPrisma.lessonProgress.findFirst.mockResolvedValue({
        updatedAt: new Date(),
      });

      const result = await service.getMyCourses(USER_UUID);

      expect(result.courses[0].progress).toBe(50);
    });
  });

  // ══════════════════════════════════════════════════════════
  // getSingleLesson()
  // ══════════════════════════════════════════════════════════
  describe('getSingleLesson()', () => {
    it('returns lesson content for enrolled user when lesson is first (not locked)', async () => {
      mockPrisma.courseLesson.findUnique.mockResolvedValue(mockLesson);
      mockPrisma.courseEnrollment.findUnique.mockResolvedValue(mockEnrollment);
      mockPrisma.courseLesson.findMany.mockResolvedValue([
        { uuid: LESSON_UUID },
      ]); // only one lesson, index=0 not locked
      mockPrisma.lessonProgress.findUnique.mockResolvedValue(null);

      const result = await service.getSingleLesson(LESSON_UUID, USER_UUID);

      expect(result.uuid).toBe(LESSON_UUID);
      expect(result.isCompleted).toBe(false);
      expect(result.watchedSeconds).toBe(0);
    });

    it('throws NotFoundException when lesson not found', async () => {
      mockPrisma.courseLesson.findUnique.mockResolvedValue(null);

      await expect(
        service.getSingleLesson(LESSON_UUID, USER_UUID),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when lesson is unpublished', async () => {
      mockPrisma.courseLesson.findUnique.mockResolvedValue({
        ...mockLesson,
        isPublished: false,
      });

      await expect(
        service.getSingleLesson(LESSON_UUID, USER_UUID),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user is not enrolled', async () => {
      mockPrisma.courseLesson.findUnique.mockResolvedValue(mockLesson);
      mockPrisma.courseEnrollment.findUnique.mockResolvedValue(null);

      await expect(
        service.getSingleLesson(LESSON_UUID, USER_UUID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when lesson is locked (previous lesson not completed)', async () => {
      const PREV_UUID = 'prev-lesson-uuid-0000-000000000000';
      mockPrisma.courseLesson.findUnique.mockResolvedValue({
        ...mockLesson,
        order: 2,
      });
      mockPrisma.courseEnrollment.findUnique.mockResolvedValue(mockEnrollment);
      mockPrisma.courseLesson.findMany.mockResolvedValue([
        { uuid: PREV_UUID },
        { uuid: LESSON_UUID },
      ]);
      mockPrisma.lessonProgress.findUnique.mockResolvedValue(null); // prev not completed

      await expect(
        service.getSingleLesson(LESSON_UUID, USER_UUID),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // updateLessonProgress()
  // ══════════════════════════════════════════════════════════
  describe('updateLessonProgress()', () => {
    it('updates progress without auto-completing (below 90%)', async () => {
      mockPrisma.courseLesson.findUnique.mockResolvedValue(mockLesson);
      mockPrisma.courseEnrollment.findUnique.mockResolvedValue(mockEnrollment);
      mockPrisma.lessonProgress.upsert.mockResolvedValue({
        isCompleted: false,
        watchedSeconds: 50,
      });

      const result = await service.updateLessonProgress(
        LESSON_UUID,
        USER_UUID,
        50,
      );

      expect(result.isCompleted).toBe(false);
      expect(result.watchedSeconds).toBe(50);
    });

    it('auto-completes when >= 90% of video watched', async () => {
      mockPrisma.courseLesson.findUnique.mockResolvedValue(mockLesson); // videoDuration: 120
      mockPrisma.courseEnrollment.findUnique
        .mockResolvedValueOnce(mockEnrollment) // requireEnrolledLesson
        .mockResolvedValueOnce({ ...mockEnrollment, completedAt: null }); // checkAndFinalizeCourse
      mockPrisma.lessonProgress.upsert.mockResolvedValue({
        isCompleted: true,
        watchedSeconds: 110,
      });
      mockPrisma.courseLesson.findMany.mockResolvedValue([
        { uuid: LESSON_UUID },
      ]);
      mockPrisma.lessonProgress.count.mockResolvedValue(0); // course not fully done

      const result = await service.updateLessonProgress(
        LESSON_UUID,
        USER_UUID,
        110,
      ); // 110 >= 120 * 0.9

      expect(result.isCompleted).toBe(true);
    });

    it('throws NotFoundException when lesson not found', async () => {
      mockPrisma.courseLesson.findUnique.mockResolvedValue(null);

      await expect(
        service.updateLessonProgress(LESSON_UUID, USER_UUID, 50),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user not enrolled', async () => {
      mockPrisma.courseLesson.findUnique.mockResolvedValue(mockLesson);
      mockPrisma.courseEnrollment.findUnique.mockResolvedValue(null);

      await expect(
        service.updateLessonProgress(LESSON_UUID, USER_UUID, 50),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // completeLesson()
  // ══════════════════════════════════════════════════════════
  describe('completeLesson()', () => {
    it('marks lesson as complete and returns isCompleted: true', async () => {
      mockPrisma.courseLesson.findUnique.mockResolvedValue(mockLesson);
      mockPrisma.courseEnrollment.findUnique
        .mockResolvedValueOnce(mockEnrollment) // requireEnrolledLesson
        .mockResolvedValueOnce({ ...mockEnrollment, completedAt: null }); // checkAndFinalizeCourse
      mockPrisma.courseLesson.findMany.mockResolvedValue([
        { uuid: LESSON_UUID },
      ]);
      mockPrisma.lessonProgress.upsert.mockResolvedValue({ isCompleted: true });
      mockPrisma.lessonProgress.count.mockResolvedValue(0);

      const result = await service.completeLesson(LESSON_UUID, USER_UUID);

      expect(result.isCompleted).toBe(true);
      expect(mockPrisma.lessonProgress.upsert).toHaveBeenCalled();
    });

    it('throws NotFoundException when lesson not found', async () => {
      mockPrisma.courseLesson.findUnique.mockResolvedValue(null);

      await expect(
        service.completeLesson(LESSON_UUID, USER_UUID),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user not enrolled', async () => {
      mockPrisma.courseLesson.findUnique.mockResolvedValue(mockLesson);
      mockPrisma.courseEnrollment.findUnique.mockResolvedValue(null);

      await expect(
        service.completeLesson(LESSON_UUID, USER_UUID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when lesson is locked', async () => {
      const PREV_UUID = 'prev-lesson-uuid-1111-111111111111';
      const lockedLesson = { ...mockLesson, order: 2 };
      mockPrisma.courseLesson.findUnique.mockResolvedValue(lockedLesson);
      mockPrisma.courseEnrollment.findUnique.mockResolvedValue(mockEnrollment);
      mockPrisma.courseLesson.findMany.mockResolvedValue([
        { uuid: PREV_UUID },
        { uuid: LESSON_UUID },
      ]);
      mockPrisma.lessonProgress.findUnique.mockResolvedValue(null); // prev not completed

      await expect(
        service.completeLesson(LESSON_UUID, USER_UUID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('finalizes course and triggers certificate when all lessons complete', async () => {
      mockPrisma.courseLesson.findUnique.mockResolvedValue(mockLesson);
      mockPrisma.courseEnrollment.findUnique
        .mockResolvedValueOnce(mockEnrollment) // requireEnrolledLesson
        .mockResolvedValueOnce({
          ...mockEnrollment,
          uuid: ENROLLMENT_UUID,
          completedAt: null,
        }); // checkAndFinalizeCourse
      mockPrisma.courseLesson.findMany.mockResolvedValue([
        { uuid: LESSON_UUID },
      ]); // 1 total lesson
      mockPrisma.lessonProgress.upsert.mockResolvedValue({ isCompleted: true });
      mockPrisma.lessonProgress.count.mockResolvedValue(1); // all 1 lesson completed

      await service.completeLesson(LESSON_UUID, USER_UUID);

      expect(mockPrisma.courseEnrollment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ completedAt: expect.any(Date) }),
        }),
      );
      expect(mockCertificateService.generateForEnrollment).toHaveBeenCalledWith(
        ENROLLMENT_UUID,
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // getCertificate()
  // ══════════════════════════════════════════════════════════
  describe('getCertificate()', () => {
    it('returns certificate URL for completed course', async () => {
      mockPrisma.courseEnrollment.findUnique.mockResolvedValue({
        ...mockEnrollment,
        completedAt: new Date('2026-03-01'),
      });
      mockCertificateService.getOrGenerate.mockResolvedValue({
        certificateUrl: 'https://r2.dev/cert.pdf',
        certificateId: 'cert-123',
      });

      const result = await service.getCertificate(COURSE_UUID, USER_UUID);

      expect(result.certificateUrl).toBe('https://r2.dev/cert.pdf');
      expect(mockCertificateService.getOrGenerate).toHaveBeenCalledWith(
        ENROLLMENT_UUID,
      );
    });

    it('throws NotFoundException when enrollment not found', async () => {
      mockPrisma.courseEnrollment.findUnique.mockResolvedValue(null);

      await expect(
        service.getCertificate(COURSE_UUID, USER_UUID),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when course is not completed yet', async () => {
      mockPrisma.courseEnrollment.findUnique.mockResolvedValue({
        ...mockEnrollment,
        completedAt: null,
      });

      await expect(
        service.getCertificate(COURSE_UUID, USER_UUID),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
