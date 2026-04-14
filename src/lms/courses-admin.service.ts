import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';
import { CreateSectionDto } from './dto/create-section.dto.js';
import { UpdateSectionDto } from './dto/update-section.dto.js';
import { CreateLessonDto } from './dto/create-lesson.dto.js';
import { UpdateLessonDto } from './dto/update-lesson.dto.js';

@Injectable()
export class CoursesAdminService {
  private readonly logger = new Logger(CoursesAdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── COURSES ──────────────────────────────────────────────

  async createCourse(dto: CreateCourseDto) {
    if (!dto.isFree && (dto.price === undefined || dto.price === null)) {
      throw new BadRequestException('Price is required for paid courses');
    }
    const course = await this.prisma.course.create({
      data: {
        title: dto.title,
        description: dto.description,
        thumbnailUrl: dto.thumbnailUrl ?? null,
        isFree: dto.isFree,
        price: dto.isFree ? 0 : (dto.price ?? 0),
        previewVideoUrl: dto.previewVideoUrl ?? null,
        badge: dto.badge ?? null,
        instructors: dto.instructors ?? [],
        whatYouWillLearn: dto.whatYouWillLearn ?? [],
        originalPrice: dto.originalPrice ?? null,
        totalDuration: dto.totalDuration ?? null,
        enrollmentBoost: dto.enrollmentBoost ?? 0,
      },
    });
    this.logger.log(`Course created: ${course.uuid}`);
    return course;
  }

  async findAllCourses() {
    const courses = await this.prisma.course.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { enrollments: true, sections: true },
        },
        sections: {
          include: {
            _count: { select: { lessons: true } },
          },
        },
      },
    });

    return courses.map((c) => ({
      uuid: c.uuid,
      title: c.title,
      description: c.description,
      thumbnailUrl: c.thumbnailUrl,
      isFree: c.isFree,
      price: c.price,
      isPublished: c.isPublished,
      badge: c.badge,
      createdAt: c.createdAt,
      totalEnrollments: c._count.enrollments,
      totalLessons: c.sections.reduce((sum, s) => sum + s._count.lessons, 0),
    }));
  }

  async findOneCourse(uuid: string) {
    const course = await this.prisma.course.findUnique({
      where: { uuid },
      include: {
        _count: { select: { enrollments: true } },
        sections: {
          orderBy: { order: 'asc' },
          include: {
            lessons: {
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    if (!course) throw new NotFoundException('Course not found');

    const allLessons = course.sections.flatMap((s) => s.lessons);
    const totalLessons = allLessons.length;
    const totalSections = course.sections.length;
    const totalPdfs = allLessons.filter((l) => l.attachmentUrl != null).length;

    const originalPrice = course.originalPrice != null ? Number(course.originalPrice) : null;
    const discountPercent =
      originalPrice != null && originalPrice > course.price
        ? Math.round(((originalPrice - course.price) / originalPrice) * 100)
        : null;

    return {
      uuid: course.uuid,
      title: course.title,
      description: course.description,
      thumbnailUrl: course.thumbnailUrl,
      isFree: course.isFree,
      price: course.price,
      isPublished: course.isPublished,
      createdAt: course.createdAt,
      previewVideoUrl: course.previewVideoUrl,
      badge: course.badge,
      instructors: course.instructors,
      whatYouWillLearn: course.whatYouWillLearn,
      originalPrice,
      totalDuration: course.totalDuration,
      enrollmentBoost: course.enrollmentBoost,
      totalEnrollments: course._count.enrollments,
      totalLessons,
      totalSections,
      totalPdfs,
      discountPercent,
      sections: course.sections.map((s) => ({
        uuid: s.uuid,
        title: s.title,
        order: s.order,
        lessons: s.lessons.map((l) => ({
          uuid: l.uuid,
          title: l.title,
          description: l.description,
          videoUrl: l.videoUrl,
          videoDuration: l.videoDuration,
          textContent: l.textContent,
          pdfUrl: l.pdfUrl,
          isPreview: l.isPreview,
          attachmentUrl: l.attachmentUrl,
          attachmentName: l.attachmentName,
          order: l.order,
          isPublished: l.isPublished,
        })),
      })),
    };
  }

  async findCourseForUpdate(uuid: string) {
    const course = await this.requireCourse(uuid);
    return {
      title: course.title,
      description: course.description,
      thumbnailUrl: course.thumbnailUrl,
      isFree: course.isFree,
      price: course.price,
      previewVideoUrl: course.previewVideoUrl,
      badge: course.badge,
      instructors: course.instructors,
      whatYouWillLearn: course.whatYouWillLearn,
      originalPrice: course.originalPrice != null ? Number(course.originalPrice) : null,
      totalDuration: course.totalDuration,
      enrollmentBoost: course.enrollmentBoost,
    };
  }

  async updateCourse(uuid: string, dto: UpdateCourseDto) {
    await this.requireCourse(uuid);
    return this.prisma.course.update({
      where: { uuid },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.thumbnailUrl !== undefined && { thumbnailUrl: dto.thumbnailUrl }),
        ...(dto.isFree !== undefined && { isFree: dto.isFree }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.previewVideoUrl !== undefined && { previewVideoUrl: dto.previewVideoUrl }),
        ...(dto.badge !== undefined && { badge: dto.badge }),
        ...(dto.instructors !== undefined && { instructors: dto.instructors }),
        ...(dto.whatYouWillLearn !== undefined && { whatYouWillLearn: dto.whatYouWillLearn }),
        ...(dto.originalPrice !== undefined && { originalPrice: dto.originalPrice }),
        ...(dto.totalDuration !== undefined && { totalDuration: dto.totalDuration }),
        ...(dto.enrollmentBoost !== undefined && { enrollmentBoost: dto.enrollmentBoost }),
      },
    });
  }

  async deleteCourse(uuid: string) {
    await this.requireCourse(uuid);

    const enrollmentCount = await this.prisma.courseEnrollment.count({
      where: { courseUuid: uuid },
    });
    if (enrollmentCount > 0) {
      throw new BadRequestException(
        'Cannot delete course with active enrollments. Unpublish it instead.',
      );
    }

    await this.prisma.course.delete({ where: { uuid } });
    this.logger.log(`Course deleted: ${uuid}`);
    return { deleted: true };
  }

  async publishCourse(uuid: string) {
    await this.requireCourse(uuid);
    return this.prisma.course.update({ where: { uuid }, data: { isPublished: true } });
  }

  async unpublishCourse(uuid: string) {
    await this.requireCourse(uuid);
    return this.prisma.course.update({ where: { uuid }, data: { isPublished: false } });
  }

  // ─── SECTIONS ─────────────────────────────────────────────

  async createSection(courseUuid: string, dto: CreateSectionDto) {
    await this.requireCourse(courseUuid);
    const section = await this.prisma.courseSection.create({
      data: { courseUuid, title: dto.title, order: dto.order },
    });
    this.logger.log(`Section created: ${section.uuid} in course=${courseUuid}`);
    return section;
  }

  async findSectionForUpdate(courseUuid: string, sectionUuid: string) {
    const section = await this.requireSection(courseUuid, sectionUuid);
    return {
      title: section.title,
      order: section.order,
    };
  }

  async updateSection(courseUuid: string, sectionUuid: string, dto: UpdateSectionDto) {
    await this.requireSection(courseUuid, sectionUuid);
    return this.prisma.courseSection.update({
      where: { uuid: sectionUuid },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.order !== undefined && { order: dto.order }),
      },
    });
  }

  async deleteSection(courseUuid: string, sectionUuid: string) {
    await this.requireSection(courseUuid, sectionUuid);
    await this.prisma.courseSection.delete({ where: { uuid: sectionUuid } });
    this.logger.log(`Section deleted: ${sectionUuid}`);
    return { deleted: true };
  }

  async reorderSections(courseUuid: string, orderedUuids: string[]) {
    await this.requireCourse(courseUuid);
    await this.prisma.$transaction(
      orderedUuids.map((uuid, index) =>
        this.prisma.courseSection.update({
          where: { uuid },
          data: { order: index + 1 },
        }),
      ),
    );
    return { reordered: true };
  }

  // ─── LESSONS ──────────────────────────────────────────────

  async createLesson(courseUuid: string, sectionUuid: string, dto: CreateLessonDto) {
    await this.requireSection(courseUuid, sectionUuid);
    const lesson = await this.prisma.courseLesson.create({
      data: {
        sectionUuid,
        title: dto.title,
        description: dto.description ?? null,
        videoUrl: dto.videoUrl ?? null,
        videoDuration: dto.videoDuration ?? null,
        textContent: dto.textContent ?? null,
        pdfUrl: dto.pdfUrl ?? null,
        isPreview: dto.isPreview ?? false,
        attachmentUrl: dto.attachmentUrl ?? null,
        attachmentName: dto.attachmentName ?? null,
        order: dto.order,
        isPublished: dto.isPublished,
      },
    });
    this.logger.log(`Lesson created: ${lesson.uuid} in section=${sectionUuid}`);
    return lesson;
  }

  async findLessonForUpdate(courseUuid: string, sectionUuid: string, lessonUuid: string) {
    const lesson = await this.requireLesson(courseUuid, sectionUuid, lessonUuid);
    return {
      title: lesson.title,
      description: lesson.description,
      videoUrl: lesson.videoUrl,
      videoDuration: lesson.videoDuration,
      textContent: lesson.textContent,
      pdfUrl: lesson.pdfUrl,
      isPreview: lesson.isPreview,
      attachmentUrl: lesson.attachmentUrl,
      attachmentName: lesson.attachmentName,
      order: lesson.order,
      isPublished: lesson.isPublished,
    };
  }

  async updateLesson(
    courseUuid: string,
    sectionUuid: string,
    lessonUuid: string,
    dto: UpdateLessonDto,
  ) {
    await this.requireLesson(courseUuid, sectionUuid, lessonUuid);
    return this.prisma.courseLesson.update({
      where: { uuid: lessonUuid },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.videoUrl !== undefined && { videoUrl: dto.videoUrl }),
        ...(dto.videoDuration !== undefined && { videoDuration: dto.videoDuration }),
        ...(dto.textContent !== undefined && { textContent: dto.textContent }),
        ...(dto.pdfUrl !== undefined && { pdfUrl: dto.pdfUrl }),
        ...(dto.isPreview !== undefined && { isPreview: dto.isPreview }),
        ...(dto.attachmentUrl !== undefined && { attachmentUrl: dto.attachmentUrl }),
        ...(dto.attachmentName !== undefined && { attachmentName: dto.attachmentName }),
        ...(dto.order !== undefined && { order: dto.order }),
        ...(dto.isPublished !== undefined && { isPublished: dto.isPublished }),
      },
    });
  }

  async deleteLesson(courseUuid: string, sectionUuid: string, lessonUuid: string) {
    await this.requireLesson(courseUuid, sectionUuid, lessonUuid);
    await this.prisma.courseLesson.delete({ where: { uuid: lessonUuid } });
    this.logger.log(`Lesson deleted: ${lessonUuid}`);
    return { deleted: true };
  }

  async reorderLessons(courseUuid: string, sectionUuid: string, orderedUuids: string[]) {
    await this.requireSection(courseUuid, sectionUuid);
    await this.prisma.$transaction(
      orderedUuids.map((uuid, index) =>
        this.prisma.courseLesson.update({
          where: { uuid },
          data: { order: index + 1 },
        }),
      ),
    );
    return { reordered: true };
  }

  // ─── ANALYTICS ────────────────────────────────────────────

  async getAnalytics() {
    const [totalCourses, publishedCourses, totalEnrollments, totalCompletions, certificatesIssued, courses] =
      await this.prisma.$transaction([
        this.prisma.course.count(),
        this.prisma.course.count({ where: { isPublished: true } }),
        this.prisma.courseEnrollment.count(),
        this.prisma.courseEnrollment.count({ where: { completedAt: { not: null } } }),
        this.prisma.courseEnrollment.count({ where: { certificateUrl: { not: null } } }),
        this.prisma.course.findMany({
          include: {
            _count: { select: { enrollments: true } },
            enrollments: { select: { completedAt: true, userUuid: true } },
            sections: { include: { lessons: { select: { uuid: true } } } },
          },
        }),
      ]);

    const completionRate =
      totalEnrollments > 0
        ? `${((totalCompletions / totalEnrollments) * 100).toFixed(1)}%`
        : '0%';

    const courseBreakdown = await Promise.all(
      courses.map(async (course) => {
        const enrollmentCount = course._count.enrollments;
        const completionCount = course.enrollments.filter((e) => e.completedAt !== null).length;

        // Calculate average progress
        const totalLessonUuids = course.sections.flatMap((s) => s.lessons.map((l) => l.uuid));
        const totalLessons = totalLessonUuids.length;
        let avgProgress = 0;

        if (enrollmentCount > 0 && totalLessons > 0) {
          const enrolledUserUuids = course.enrollments.map((e) => e.userUuid);
          const progressRecords = await this.prisma.lessonProgress.findMany({
            where: {
              lessonUuid: { in: totalLessonUuids },
              userUuid: { in: enrolledUserUuids },
              isCompleted: true,
            },
            select: { userUuid: true },
          });

          const completedByUser = new Map<string, number>();
          for (const p of progressRecords) {
            completedByUser.set(p.userUuid, (completedByUser.get(p.userUuid) ?? 0) + 1);
          }

          const totalProgress = enrolledUserUuids.reduce(
            (sum, uid) => sum + ((completedByUser.get(uid) ?? 0) / totalLessons) * 100,
            0,
          );
          avgProgress = Math.round(totalProgress / enrollmentCount);
        }

        const courseCompletionRate =
          enrollmentCount > 0
            ? `${((completionCount / enrollmentCount) * 100).toFixed(1)}%`
            : '0%';

        return {
          uuid: course.uuid,
          title: course.title,
          isFree: course.isFree,
          enrollments: enrollmentCount,
          completions: completionCount,
          completionRate: courseCompletionRate,
          avgProgress,
        };
      }),
    );

    return {
      totalCourses,
      publishedCourses,
      totalEnrollments,
      totalCompletions,
      completionRate,
      certificatesIssued,
      courseBreakdown,
    };
  }

  // ─── PRIVATE HELPERS ──────────────────────────────────────

  private async requireCourse(uuid: string) {
    const course = await this.prisma.course.findUnique({ where: { uuid } });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  private async requireSection(courseUuid: string, sectionUuid: string) {
    const section = await this.prisma.courseSection.findFirst({
      where: { uuid: sectionUuid, courseUuid },
    });
    if (!section) throw new NotFoundException('Section not found in this course');
    return section;
  }

  private async requireLesson(courseUuid: string, sectionUuid: string, lessonUuid: string) {
    const lesson = await this.prisma.courseLesson.findFirst({
      where: {
        uuid: lessonUuid,
        sectionUuid,
        section: { courseUuid },
      },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    return lesson;
  }
}
