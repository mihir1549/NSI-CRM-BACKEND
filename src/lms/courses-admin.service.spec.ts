import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CoursesAdminService } from './courses-admin.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const COURSE_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const SECTION_UUID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const LESSON_UUID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

const mockCourse = {
  uuid: COURSE_UUID,
  title: 'Test Course',
  description: 'A great course',
  thumbnailUrl: null,
  isFree: false,
  price: 999,
  isPublished: false,
  createdAt: new Date('2026-01-01'),
  _count: { enrollments: 0 },
  sections: [],
  enrollments: [],
};

const mockSection = {
  uuid: SECTION_UUID,
  courseUuid: COURSE_UUID,
  title: 'Section One',
  order: 1,
  lessons: [],
};

const mockLesson = {
  uuid: LESSON_UUID,
  sectionUuid: SECTION_UUID,
  title: 'Lesson One',
  description: null,
  videoUrl: null,
  videoDuration: null,
  textContent: null,
  pdfUrl: null,
  order: 1,
  isPublished: false,
};

// ─── Prisma mock ──────────────────────────────────────────────────────────────
const mockPrisma = {
  course: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  courseSection: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  courseLesson: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  courseEnrollment: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  lessonProgress: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('CoursesAdminService', () => {
  let service: CoursesAdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoursesAdminService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CoursesAdminService>(CoursesAdminService);
    jest.clearAllMocks();

    // Safe defaults
    mockPrisma.course.findUnique.mockResolvedValue(mockCourse);
    mockPrisma.course.create.mockResolvedValue(mockCourse);
    mockPrisma.course.update.mockResolvedValue(mockCourse);
    mockPrisma.course.delete.mockResolvedValue(mockCourse);
    mockPrisma.course.findMany.mockResolvedValue([]);
    mockPrisma.course.count.mockResolvedValue(0);
    mockPrisma.courseSection.findFirst.mockResolvedValue(mockSection);
    mockPrisma.courseSection.create.mockResolvedValue(mockSection);
    mockPrisma.courseSection.update.mockResolvedValue(mockSection);
    mockPrisma.courseSection.delete.mockResolvedValue(mockSection);
    mockPrisma.courseLesson.findFirst.mockResolvedValue(mockLesson);
    mockPrisma.courseLesson.create.mockResolvedValue(mockLesson);
    mockPrisma.courseLesson.update.mockResolvedValue(mockLesson);
    mockPrisma.courseLesson.delete.mockResolvedValue(mockLesson);
    mockPrisma.courseEnrollment.count.mockResolvedValue(0);
    mockPrisma.courseEnrollment.findMany.mockResolvedValue([]);
    mockPrisma.lessonProgress.findMany.mockResolvedValue([]);
    mockPrisma.$transaction.mockResolvedValue([]);
  });

  // ══════════════════════════════════════════════════════════
  // createCourse()
  // ══════════════════════════════════════════════════════════
  describe('createCourse()', () => {
    it('creates a free course successfully', async () => {
      const dto = { title: 'Free Course', description: 'desc', isFree: true };

      const result = await service.createCourse(dto as any);

      expect(mockPrisma.course.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ title: 'Free Course', isFree: true }),
        }),
      );
      expect(result.uuid).toBe(COURSE_UUID);
    });

    it('creates a paid course successfully', async () => {
      const dto = {
        title: 'Paid Course',
        description: 'desc',
        isFree: false,
        price: 499,
      };

      await service.createCourse(dto as any);

      expect(mockPrisma.course.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ price: 499 }),
        }),
      );
    });

    it('throws BadRequestException if paid course has no price', async () => {
      const dto = { title: 'Course', description: 'desc', isFree: false };

      await expect(service.createCourse(dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // findAllCourses()
  // ══════════════════════════════════════════════════════════
  describe('findAllCourses()', () => {
    it('returns all courses with enrollment and lesson counts', async () => {
      mockPrisma.course.findMany.mockResolvedValue([mockCourse]);

      const result = await service.findAllCourses();

      expect(result).toHaveLength(1);
      expect(result[0].uuid).toBe(COURSE_UUID);
      expect(result[0].totalEnrollments).toBe(0);
      expect(result[0].totalLessons).toBe(0);
    });

    it('returns empty array when no courses', async () => {
      mockPrisma.course.findMany.mockResolvedValue([]);

      const result = await service.findAllCourses();

      expect(result).toHaveLength(0);
    });
  });

  // ══════════════════════════════════════════════════════════
  // findOneCourse() (admin)
  // ══════════════════════════════════════════════════════════
  describe('findOneCourse()', () => {
    it('returns course with sections and lessons', async () => {
      mockPrisma.course.findUnique.mockResolvedValue({
        ...mockCourse,
        sections: [{ ...mockSection, lessons: [mockLesson] }],
      });

      const result = await service.findOneCourse(COURSE_UUID);

      expect(result.uuid).toBe(COURSE_UUID);
      expect(result.sections).toHaveLength(1);
      expect(result.totalLessons).toBe(1);
    });

    it('throws NotFoundException when course not found', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(null);

      await expect(service.findOneCourse(COURSE_UUID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // findCourseForUpdate()
  // ══════════════════════════════════════════════════════════
  describe('findCourseForUpdate()', () => {
    it('returns course editable fields', async () => {
      const result = await service.findCourseForUpdate(COURSE_UUID);

      expect(result.title).toBe('Test Course');
      expect(result.isFree).toBe(false);
    });

    it('throws NotFoundException when course not found', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(null);

      await expect(service.findCourseForUpdate(COURSE_UUID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // updateCourse()
  // ══════════════════════════════════════════════════════════
  describe('updateCourse()', () => {
    it('updates course fields', async () => {
      const dto = { title: 'Updated Title' };

      const result = await service.updateCourse(COURSE_UUID, dto as any);

      expect(mockPrisma.course.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uuid: COURSE_UUID },
          data: { title: 'Updated Title' },
        }),
      );
      expect(result).toBeDefined();
    });

    it('throws NotFoundException when course not found', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(null);

      await expect(
        service.updateCourse(COURSE_UUID, {} as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // deleteCourse()
  // ══════════════════════════════════════════════════════════
  describe('deleteCourse()', () => {
    it('deletes course with no enrollments', async () => {
      mockPrisma.courseEnrollment.count.mockResolvedValue(0);

      const result = await service.deleteCourse(COURSE_UUID);

      expect(result).toEqual({ deleted: true });
      expect(mockPrisma.course.delete).toHaveBeenCalledWith({
        where: { uuid: COURSE_UUID },
      });
    });

    it('throws NotFoundException when course not found', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(null);

      await expect(service.deleteCourse(COURSE_UUID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when course has active enrollments', async () => {
      mockPrisma.courseEnrollment.count.mockResolvedValue(5);

      await expect(service.deleteCourse(COURSE_UUID)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // publishCourse() / unpublishCourse()
  // ══════════════════════════════════════════════════════════
  describe('publishCourse()', () => {
    it('publishes a course', async () => {
      await service.publishCourse(COURSE_UUID);

      expect(mockPrisma.course.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isPublished: true } }),
      );
    });

    it('throws NotFoundException when course not found', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(null);

      await expect(service.publishCourse(COURSE_UUID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('unpublishCourse()', () => {
    it('unpublishes a course', async () => {
      await service.unpublishCourse(COURSE_UUID);

      expect(mockPrisma.course.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isPublished: false } }),
      );
    });

    it('throws NotFoundException when course not found', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(null);

      await expect(service.unpublishCourse(COURSE_UUID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // createSection()
  // ══════════════════════════════════════════════════════════
  describe('createSection()', () => {
    it('creates section in existing course', async () => {
      const dto = { title: 'Section 1', order: 1 };

      const result = await service.createSection(COURSE_UUID, dto as any);

      expect(mockPrisma.courseSection.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            courseUuid: COURSE_UUID,
            title: 'Section 1',
          }),
        }),
      );
      expect(result.uuid).toBe(SECTION_UUID);
    });

    it('throws NotFoundException when course not found', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(null);

      await expect(
        service.createSection(COURSE_UUID, { title: 'S', order: 1 } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // findSectionForUpdate()
  // ══════════════════════════════════════════════════════════
  describe('findSectionForUpdate()', () => {
    it('returns section editable fields', async () => {
      const result = await service.findSectionForUpdate(
        COURSE_UUID,
        SECTION_UUID,
      );

      expect(result.title).toBe('Section One');
      expect(result.order).toBe(1);
    });

    it('throws NotFoundException when section not found', async () => {
      mockPrisma.courseSection.findFirst.mockResolvedValue(null);

      await expect(
        service.findSectionForUpdate(COURSE_UUID, SECTION_UUID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // updateSection()
  // ══════════════════════════════════════════════════════════
  describe('updateSection()', () => {
    it('updates section', async () => {
      const dto = { title: 'Updated Section' };

      await service.updateSection(COURSE_UUID, SECTION_UUID, dto as any);

      expect(mockPrisma.courseSection.update).toHaveBeenCalled();
    });

    it('throws NotFoundException when section not found', async () => {
      mockPrisma.courseSection.findFirst.mockResolvedValue(null);

      await expect(
        service.updateSection(COURSE_UUID, SECTION_UUID, {} as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // deleteSection()
  // ══════════════════════════════════════════════════════════
  describe('deleteSection()', () => {
    it('deletes section successfully', async () => {
      const result = await service.deleteSection(COURSE_UUID, SECTION_UUID);

      expect(result).toEqual({ deleted: true });
      expect(mockPrisma.courseSection.delete).toHaveBeenCalledWith({
        where: { uuid: SECTION_UUID },
      });
    });

    it('throws NotFoundException when section not found', async () => {
      mockPrisma.courseSection.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteSection(COURSE_UUID, SECTION_UUID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // reorderSections()
  // ══════════════════════════════════════════════════════════
  describe('reorderSections()', () => {
    it('reorders sections successfully', async () => {
      mockPrisma.$transaction.mockResolvedValue([mockSection, mockSection]);

      const result = await service.reorderSections(COURSE_UUID, [
        SECTION_UUID,
        'other-uuid',
      ]);

      expect(result).toEqual({ reordered: true });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('throws NotFoundException when course not found', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(null);

      await expect(
        service.reorderSections(COURSE_UUID, [SECTION_UUID]),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // createLesson()
  // ══════════════════════════════════════════════════════════
  describe('createLesson()', () => {
    it('creates lesson in a section', async () => {
      const dto = { title: 'Lesson 1', order: 1, isPublished: false };

      const result = await service.createLesson(
        COURSE_UUID,
        SECTION_UUID,
        dto as any,
      );

      expect(mockPrisma.courseLesson.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sectionUuid: SECTION_UUID,
            title: 'Lesson 1',
          }),
        }),
      );
      expect(result.uuid).toBe(LESSON_UUID);
    });

    it('throws NotFoundException when section not found', async () => {
      mockPrisma.courseSection.findFirst.mockResolvedValue(null);

      await expect(
        service.createLesson(COURSE_UUID, SECTION_UUID, {
          title: 'L',
          order: 1,
          isPublished: false,
        } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // findLessonForUpdate()
  // ══════════════════════════════════════════════════════════
  describe('findLessonForUpdate()', () => {
    it('returns lesson editable fields', async () => {
      const result = await service.findLessonForUpdate(
        COURSE_UUID,
        SECTION_UUID,
        LESSON_UUID,
      );

      expect(result.title).toBe('Lesson One');
      expect(result.order).toBe(1);
    });

    it('throws NotFoundException when lesson not found', async () => {
      mockPrisma.courseLesson.findFirst.mockResolvedValue(null);

      await expect(
        service.findLessonForUpdate(COURSE_UUID, SECTION_UUID, LESSON_UUID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // updateLesson()
  // ══════════════════════════════════════════════════════════
  describe('updateLesson()', () => {
    it('updates lesson fields', async () => {
      const dto = { title: 'Updated Lesson' };

      await service.updateLesson(
        COURSE_UUID,
        SECTION_UUID,
        LESSON_UUID,
        dto as any,
      );

      expect(mockPrisma.courseLesson.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uuid: LESSON_UUID },
          data: { title: 'Updated Lesson' },
        }),
      );
    });

    it('throws NotFoundException when lesson not found', async () => {
      mockPrisma.courseLesson.findFirst.mockResolvedValue(null);

      await expect(
        service.updateLesson(COURSE_UUID, SECTION_UUID, LESSON_UUID, {} as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // deleteLesson()
  // ══════════════════════════════════════════════════════════
  describe('deleteLesson()', () => {
    it('deletes lesson successfully', async () => {
      const result = await service.deleteLesson(
        COURSE_UUID,
        SECTION_UUID,
        LESSON_UUID,
      );

      expect(result).toEqual({ deleted: true });
      expect(mockPrisma.courseLesson.delete).toHaveBeenCalledWith({
        where: { uuid: LESSON_UUID },
      });
    });

    it('throws NotFoundException when lesson not found', async () => {
      mockPrisma.courseLesson.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteLesson(COURSE_UUID, SECTION_UUID, LESSON_UUID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // reorderLessons()
  // ══════════════════════════════════════════════════════════
  describe('reorderLessons()', () => {
    it('reorders lessons successfully', async () => {
      mockPrisma.$transaction.mockResolvedValue([mockLesson]);

      const result = await service.reorderLessons(COURSE_UUID, SECTION_UUID, [
        LESSON_UUID,
      ]);

      expect(result).toEqual({ reordered: true });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('throws NotFoundException when section not found', async () => {
      mockPrisma.courseSection.findFirst.mockResolvedValue(null);

      await expect(
        service.reorderLessons(COURSE_UUID, SECTION_UUID, [LESSON_UUID]),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // getAnalytics()
  // ══════════════════════════════════════════════════════════
  describe('getAnalytics()', () => {
    it('returns analytics summary with zero courses', async () => {
      mockPrisma.$transaction.mockResolvedValue([0, 0, 0, 0, 0, []]);

      const result = await service.getAnalytics();

      expect(result.totalCourses).toBe(0);
      expect(result.publishedCourses).toBe(0);
      expect(result.completionRate).toBe(0);
      expect(result.courseBreakdown).toHaveLength(0);
    });

    it('calculates completion rate correctly', async () => {
      mockPrisma.$transaction.mockResolvedValue([2, 1, 10, 5, 3, []]);

      const result = await service.getAnalytics();

      expect(result.totalEnrollments).toBe(10);
      expect(result.totalCompletions).toBe(5);
      expect(result.completionRate).toBe(50);
      expect(result.certificatesIssued).toBe(3);
    });

    it('includes per-course breakdown with enrolled users', async () => {
      const courseWithEnrollments = {
        ...mockCourse,
        _count: { enrollments: 1 },
        enrollments: [{ completedAt: new Date(), userUuid: 'user-1' }],
        sections: [{ lessons: [{ uuid: LESSON_UUID }] }],
      };
      mockPrisma.$transaction.mockResolvedValue([
        1,
        1,
        1,
        1,
        0,
        [courseWithEnrollments],
      ]);
      mockPrisma.lessonProgress.findMany.mockResolvedValue([]);

      const result = await service.getAnalytics();

      expect(result.courseBreakdown).toHaveLength(1);
      expect(result.courseBreakdown[0].uuid).toBe(COURSE_UUID);
      expect(result.courseBreakdown[0].completionRate).toBe(100);
    });
  });
});
