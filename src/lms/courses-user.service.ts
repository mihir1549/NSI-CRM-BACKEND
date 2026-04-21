import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { VIDEO_PROVIDER_TOKEN, IVideoProvider } from '../common/video/video-provider.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CertificateService } from './certificate.service.js';

@Injectable()
export class CoursesUserService {
  private readonly logger = new Logger(CoursesUserService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly certificateService: CertificateService,
    @Inject(VIDEO_PROVIDER_TOKEN)
    private readonly videoProvider: IVideoProvider,
  ) {}

  // ─── BROWSE COURSES ───────────────────────────────────────

  /**
   * Returns all published courses with enrollment status for the requesting user.
   */
  async findAllPublished(userUuid: string) {
    const [courses, enrollments] = await Promise.all([
      this.prisma.course.findMany({
        where: { isPublished: true },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { enrollments: true } },
          sections: {
            include: {
              _count: { select: { lessons: true } },
            },
          },
        },
      }),
      this.prisma.courseEnrollment.findMany({
        where: { userUuid },
        select: { courseUuid: true, completedAt: true },
      }),
    ]);

    const enrollmentMap = new Map(enrollments.map((e) => [e.courseUuid, e]));

    // Get progress for enrolled courses
    const enrolledCourseUuids = enrollments.map((e) => e.courseUuid);
    const progressMap = await this.buildProgressMap(
      userUuid,
      enrolledCourseUuids,
      courses,
    );

    return courses.map((course) => {
      const enrollment = enrollmentMap.get(course.uuid);
      const isEnrolled = !!enrollment;
      const totalLessons = course.sections.reduce(
        (sum, s) => sum + s._count.lessons,
        0,
      );

      const realEnrollments = course._count?.enrollments ?? 0;
      const displayEnrollmentCount =
        realEnrollments + (course.enrollmentBoost ?? 0);

      const originalPrice =
        course.originalPrice != null ? Number(course.originalPrice) : null;
      const discountPercent =
        originalPrice != null && originalPrice > course.price
          ? Math.round(((originalPrice - course.price) / originalPrice) * 100)
          : null;

      const hasBunnyPreview = !!course.previewBunnyVideoId;
      const previewExpiresInSeconds = 7200;
      const previewExpiresAt = hasBunnyPreview
        ? Math.floor(Date.now() / 1000) + previewExpiresInSeconds
        : null;

      return {
        uuid: course.uuid,
        title: course.title,
        description: course.description,
        thumbnailUrl: course.thumbnailUrl,
        isFree: course.isFree,
        price: course.price,
        badge: course.badge ?? null,
        totalDuration: course.totalDuration ?? null,
        previewVideoUrl: hasBunnyPreview
          ? this.videoProvider.getSignedUrl(
              course.previewBunnyVideoId!,
              previewExpiresInSeconds,
            )
          : (course.previewVideoUrl ?? null),
        previewVideoProvider: hasBunnyPreview ? 'bunny' : 'direct',
        previewVideoExpiry: previewExpiresAt,
        previewBunnyVideoId: course.previewBunnyVideoId,
        instructors: course.instructors ?? [],
        whatYouWillLearn: course.whatYouWillLearn ?? [],
        originalPrice,
        discountPercent,
        totalSections: course.sections.length,
        totalLessons,
        displayEnrollmentCount,
        isEnrolled,
        progress: isEnrolled ? (progressMap.get(course.uuid) ?? 0) : null,
      };
    });
  }

  /**
   * Returns course detail + enrollment status + sections with preview-aware lesson visibility.
   */
  async findOneCourse(courseUuid: string, userUuid: string) {
    const course = await this.prisma.course.findUnique({
      where: { uuid: courseUuid, isPublished: true },
      include: {
        _count: { select: { enrollments: true } },
        sections: {
          orderBy: { order: 'asc' },
          include: {
            lessons: {
              orderBy: { order: 'asc' },
              select: {
                uuid: true,
                title: true,
                order: true,
                videoDuration: true,
                isPreview: true,
                videoUrl: true,
                bunnyVideoId: true,
                textContent: true,
                attachmentUrl: true,
                attachmentName: true,
              },
            },
          },
        },
      },
    });

    if (!course) throw new NotFoundException('Course not found');

    const enrollment = await this.prisma.courseEnrollment.findUnique({
      where: { userUuid_courseUuid: { userUuid, courseUuid } },
    });

    const isEnrolled = !!enrollment;

    const realEnrollments = course._count?.enrollments ?? 0;
    const displayEnrollmentCount =
      realEnrollments + (course.enrollmentBoost ?? 0);

    const originalPrice =
      course.originalPrice != null ? Number(course.originalPrice) : null;
    const discountPercent =
      originalPrice != null && originalPrice > course.price
        ? Math.round(((originalPrice - course.price) / originalPrice) * 100)
        : null;

    const totalLessons = course.sections.reduce(
      (s, sec) => s + sec.lessons.length,
      0,
    );

    let enrollmentDto: {
      enrolledAt: Date;
      completedAt: Date | null;
      progress: number;
    } | null = null;

    let completedLessonUuids = new Set<string>();

    if (enrollment) {
      const allLessonUuids = course.sections.flatMap((s) =>
        s.lessons.map((l) => l.uuid),
      );
      const progressRecords = await this.prisma.lessonProgress.findMany({
        where: {
          userUuid,
          lessonUuid: { in: allLessonUuids },
          isCompleted: true,
        },
        select: { lessonUuid: true },
      });
      completedLessonUuids = new Set(progressRecords.map((p) => p.lessonUuid));

      const progress =
        allLessonUuids.length > 0
          ? Math.round(
              (completedLessonUuids.size / allLessonUuids.length) * 100,
            )
          : 0;

      enrollmentDto = {
        enrolledAt: enrollment.enrolledAt,
        completedAt: enrollment.completedAt,
        progress,
      };
    }

    // Build all lessons ordered for locked-state calculation (enrolled path)
    const allLessons = course.sections.flatMap((s) =>
      s.lessons.map((l) => ({ ...l, sectionUuid: s.uuid })),
    );
    allLessons.sort((a, b) => {
      const sectionA = course.sections.findIndex(
        (s) => s.uuid === a.sectionUuid,
      );
      const sectionB = course.sections.findIndex(
        (s) => s.uuid === b.sectionUuid,
      );
      if (sectionA !== sectionB) return sectionA - sectionB;
      return a.order - b.order;
    });

    const sections = course.sections.map((section) => ({
      uuid: section.uuid,
      title: section.title,
      order: section.order,
      lessons: section.lessons.map((lesson) => {
        const lessonPreview = lesson.isPreview ?? false;

        if (!isEnrolled) {
          // Landing page — show content only for preview lessons
          const hasBunny = lessonPreview && !!lesson.bunnyVideoId;
          const expiresInSeconds = 7200;
          const expiresAt = hasBunny
            ? Math.floor(Date.now() / 1000) + expiresInSeconds
            : null;

          return {
            uuid: lesson.uuid,
            title: lesson.title,
            order: lesson.order,
            videoDuration: lesson.videoDuration,
            isPreview: lessonPreview,
            videoUrl: hasBunny
              ? this.videoProvider.getSignedUrl(
                  lesson.bunnyVideoId!,
                  expiresInSeconds,
                )
              : lessonPreview
                ? lesson.videoUrl
                : null,
            videoProvider: hasBunny ? 'bunny' : lessonPreview ? 'direct' : null,
            videoExpiry: expiresAt,
            bunnyVideoId: lessonPreview ? lesson.bunnyVideoId : null,
            textContent: lessonPreview ? lesson.textContent : null,
            attachmentUrl: lessonPreview ? lesson.attachmentUrl : null,
            attachmentName: lessonPreview ? lesson.attachmentName : null,
          };
        }

        // Enrolled — show lock state, no content (use /learn endpoint for content)
        const lessonIndex = allLessons.findIndex((l) => l.uuid === lesson.uuid);
        const isFirst = lessonIndex === 0;
        const previousLesson =
          lessonIndex > 0 ? allLessons[lessonIndex - 1] : null;
        const isLocked =
          !isFirst && previousLesson
            ? !completedLessonUuids.has(previousLesson.uuid)
            : false;

        return {
          uuid: lesson.uuid,
          title: lesson.title,
          order: lesson.order,
          videoDuration: lesson.videoDuration,
          isPreview: lessonPreview,
          isCompleted: completedLessonUuids.has(lesson.uuid),
          isLocked,
          videoUrl: null,
          videoProvider: null,
          videoExpiry: null,
          bunnyVideoId: null,
        };
      }),
    }));

    const hasBunnyPreview = !!course.previewBunnyVideoId;
    const previewExpiresInSeconds = 7200;
    const previewExpiresAt = hasBunnyPreview
      ? Math.floor(Date.now() / 1000) + previewExpiresInSeconds
      : null;

    return {
      uuid: course.uuid,
      title: course.title,
      description: course.description,
      thumbnailUrl: course.thumbnailUrl,
      isFree: course.isFree,
      price: course.price,
      badge: course.badge ?? null,
      totalDuration: course.totalDuration ?? null,
      previewVideoUrl: hasBunnyPreview
        ? this.videoProvider.getSignedUrl(
            course.previewBunnyVideoId!,
            previewExpiresInSeconds,
          )
        : (course.previewVideoUrl ?? null),
      previewVideoProvider: hasBunnyPreview ? 'bunny' : 'direct',
      previewVideoExpiry: previewExpiresAt,
      previewBunnyVideoId: course.previewBunnyVideoId,
      instructors: course.instructors ?? [],
      whatYouWillLearn: course.whatYouWillLearn ?? [],
      originalPrice,
      discountPercent,
      totalLessons,
      displayEnrollmentCount,
      enrollment: enrollmentDto,
      sections,
    };
  }

  /**
   * Returns full course content for enrolled users (with lesson details).
   */
  async getCourseLearnContent(courseUuid: string, userUuid: string) {
    const course = await this.prisma.course.findUnique({
      where: { uuid: courseUuid, isPublished: true },
      include: {
        sections: {
          orderBy: { order: 'asc' },
          include: {
            lessons: {
              where: { isPublished: true },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });
    if (!course) throw new NotFoundException('Course not found');

    const enrollment = await this.prisma.courseEnrollment.findUnique({
      where: { userUuid_courseUuid: { userUuid, courseUuid } },
    });
    if (!enrollment)
      throw new ForbiddenException('You are not enrolled in this course');

    const allLessonUuids = course.sections.flatMap((s) =>
      s.lessons.map((l) => l.uuid),
    );
    const progressRecords = await this.prisma.lessonProgress.findMany({
      where: { userUuid, lessonUuid: { in: allLessonUuids } },
    });
    const progressMap = new Map(progressRecords.map((p) => [p.lessonUuid, p]));

    const allLessons = course.sections.flatMap((s) =>
      s.lessons.map((l) => ({ ...l, sectionUuid: s.uuid })),
    );
    allLessons.sort((a, b) => {
      const sA = course.sections.findIndex((s) => s.uuid === a.sectionUuid);
      const sB = course.sections.findIndex((s) => s.uuid === b.sectionUuid);
      if (sA !== sB) return sA - sB;
      return a.order - b.order;
    });

    const completedUuids = new Set(
      progressRecords.filter((p) => p.isCompleted).map((p) => p.lessonUuid),
    );

    const sections = course.sections.map((section) => ({
      uuid: section.uuid,
      title: section.title,
      order: section.order,
      lessons: section.lessons.map((lesson) => {
        const lessonIndex = allLessons.findIndex((l) => l.uuid === lesson.uuid);
        const isFirst = lessonIndex === 0;
        const previousLesson =
          lessonIndex > 0 ? allLessons[lessonIndex - 1] : null;
        const isLocked =
          !isFirst && previousLesson
            ? !completedUuids.has(previousLesson.uuid)
            : false;
        const progress = progressMap.get(lesson.uuid);

        const hasBunny = !!lesson.bunnyVideoId;
        const expiresInSeconds = 7200;
        const expiresAt = hasBunny
          ? Math.floor(Date.now() / 1000) + expiresInSeconds
          : null;

        return {
          uuid: lesson.uuid,
          title: lesson.title,
          description: lesson.description,
          bunnyVideoId: lesson.bunnyVideoId,
          videoUrl: hasBunny
            ? this.videoProvider.getSignedUrl(
                lesson.bunnyVideoId!,
                expiresInSeconds,
              )
            : lesson.videoUrl,
          videoProvider: hasBunny ? 'bunny' : 'direct',
          videoExpiry: expiresAt,
          videoDuration: lesson.videoDuration,
          textContent: lesson.textContent,
          pdfUrl: lesson.pdfUrl,
          isPreview: lesson.isPreview,
          attachmentUrl: lesson.attachmentUrl ?? null,
          attachmentName: lesson.attachmentName ?? null,
          order: lesson.order,
          isCompleted: progress?.isCompleted ?? false,
          watchedSeconds: progress?.watchedSeconds ?? 0,
          isLocked,
        };
      }),
    }));

    return {
      uuid: course.uuid,
      title: course.title,
      description: course.description,
      thumbnailUrl: course.thumbnailUrl,
      sections,
    };
  }

  /**
   * Returns a user's enrolled courses with progress.
   */
  async getMyCourses(userUuid: string) {
    const enrollments = await this.prisma.courseEnrollment.findMany({
      where: { userUuid },
      orderBy: { enrolledAt: 'desc' },
      include: {
        course: {
          include: {
            sections: {
              include: {
                lessons: { select: { uuid: true } },
              },
            },
          },
        },
      },
    });

    const courses = await Promise.all(
      enrollments.map(async (enrollment) => {
        const allLessonUuids = enrollment.course.sections.flatMap((s) =>
          s.lessons.map((l) => l.uuid),
        );
        const totalLessons = allLessonUuids.length;

        const completedLessons =
          totalLessons > 0
            ? await this.prisma.lessonProgress.count({
                where: {
                  userUuid,
                  lessonUuid: { in: allLessonUuids },
                  isCompleted: true,
                },
              })
            : 0;

        const progress =
          totalLessons > 0
            ? Math.round((completedLessons / totalLessons) * 100)
            : 0;

        // Last activity = most recent lessonProgress.updatedAt
        const lastActivity =
          totalLessons > 0
            ? await this.prisma.lessonProgress.findFirst({
                where: { userUuid, lessonUuid: { in: allLessonUuids } },
                orderBy: { updatedAt: 'desc' },
                select: { updatedAt: true },
              })
            : null;

        return {
          uuid: enrollment.course.uuid,
          title: enrollment.course.title,
          thumbnailUrl: enrollment.course.thumbnailUrl,
          enrolledAt: enrollment.enrolledAt,
          completedAt: enrollment.completedAt,
          progress,
          certificateUrl: enrollment.certificateUrl,
          totalLessons,
          completedLessons,
          lastActivityAt: lastActivity?.updatedAt ?? null,
        };
      }),
    );

    return { courses };
  }

  // ─── LESSON ACCESS ────────────────────────────────────────

  /**
   * Returns single lesson content for an enrolled user.
   */
  async getSingleLesson(lessonUuid: string, userUuid: string) {
    const lesson = await this.prisma.courseLesson.findUnique({
      where: { uuid: lessonUuid },
      include: {
        section: { include: { course: true } },
      },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    if (!lesson.isPublished) throw new NotFoundException('Lesson not found');

    const enrollment = await this.prisma.courseEnrollment.findUnique({
      where: {
        userUuid_courseUuid: {
          userUuid,
          courseUuid: lesson.section.course.uuid,
        },
      },
    });
    if (!enrollment)
      throw new ForbiddenException('You are not enrolled in this course');

    // Check locked status
    const isLocked = await this.isLessonLocked(lesson, userUuid);
    if (isLocked)
      throw new ForbiddenException('Complete the previous lesson first');

    const progress = await this.prisma.lessonProgress.findUnique({
      where: { userUuid_lessonUuid: { userUuid, lessonUuid } },
    });

    const hasBunny = !!lesson.bunnyVideoId;
    const expiresInSeconds = 7200;
    const expiresAt = hasBunny
      ? Math.floor(Date.now() / 1000) + expiresInSeconds
      : null;

    const videoUrl = hasBunny
      ? this.videoProvider.getSignedUrl(lesson.bunnyVideoId!, expiresInSeconds)
      : lesson.videoUrl;

    return {
      uuid: lesson.uuid,
      title: lesson.title,
      description: lesson.description,
      bunnyVideoId: lesson.bunnyVideoId,
      videoUrl,
      videoProvider: hasBunny ? 'bunny' : 'direct',
      videoExpiry: expiresAt,
      videoDuration: lesson.videoDuration,
      textContent: lesson.textContent,
      pdfUrl: lesson.pdfUrl,
      isPreview: lesson.isPreview,
      attachmentUrl: lesson.attachmentUrl ?? null,
      attachmentName: lesson.attachmentName ?? null,
      order: lesson.order,
      isCompleted: progress?.isCompleted ?? false,
      watchedSeconds: progress?.watchedSeconds ?? 0,
    };
  }

  /**
   * Generates a new signed URL for a lesson that uses Bunny Stream.
   */
  async refreshLessonToken(lessonUuid: string, userUuid: string) {
    const lesson = await this.prisma.courseLesson.findUnique({
      where: { uuid: lessonUuid },
      include: {
        section: { include: { course: true } },
      },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    if (!lesson.bunnyVideoId) {
      throw new BadRequestException('This lesson does not use Bunny Stream');
    }

    const enrollment = await this.prisma.courseEnrollment.findUnique({
      where: {
        userUuid_courseUuid: {
          userUuid,
          courseUuid: lesson.section.course.uuid,
        },
      },
    });
    if (!enrollment)
      throw new ForbiddenException('You are not enrolled in this course');

    const expiresInSeconds = 7200;
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const videoUrl = this.videoProvider.getSignedUrl(
      lesson.bunnyVideoId,
      expiresInSeconds,
    );

    return {
      videoUrl,
      videoExpiry: expiresAt,
    };
  }

  /**
   * Updates video progress for a lesson. Auto-completes at 90% watched.
   */
  async updateLessonProgress(
    lessonUuid: string,
    userUuid: string,
    watchedSeconds: number,
  ): Promise<{ isCompleted: boolean; watchedSeconds: number }> {
    const lesson = await this.requireEnrolledLesson(lessonUuid, userUuid);

    const now = new Date();
    const shouldAutoComplete =
      lesson.videoDuration !== null &&
      lesson.videoDuration > 0 &&
      watchedSeconds >= lesson.videoDuration * 0.9;

    const progressData: {
      watchedSeconds: number;
      isCompleted?: boolean;
      completedAt?: Date | null;
    } = { watchedSeconds };

    if (shouldAutoComplete) {
      progressData.isCompleted = true;
      progressData.completedAt = now;
    }

    const progress = await this.prisma.lessonProgress.upsert({
      where: { userUuid_lessonUuid: { userUuid, lessonUuid } },
      create: {
        userUuid,
        lessonUuid,
        watchedSeconds,
        isCompleted: shouldAutoComplete,
        completedAt: shouldAutoComplete ? now : null,
      },
      update: progressData,
    });

    if (shouldAutoComplete) {
      this.logger.log(
        `Lesson auto-completed: ${lessonUuid} for user=${userUuid}`,
      );
      // Check if full course completed
      await this.checkAndFinalizeCourse(lesson.section.courseUuid, userUuid);
    }

    return {
      isCompleted: progress.isCompleted,
      watchedSeconds: progress.watchedSeconds,
    };
  }

  /**
   * Manually marks a lesson as complete (for text/PDF-only lessons).
   */
  async completeLesson(
    lessonUuid: string,
    userUuid: string,
  ): Promise<{ isCompleted: boolean }> {
    const lesson = await this.requireEnrolledLesson(lessonUuid, userUuid);

    // Check if locked
    const isLocked = await this.isLessonLocked(lesson, userUuid);
    if (isLocked)
      throw new ForbiddenException('Complete the previous lesson first');

    await this.prisma.lessonProgress.upsert({
      where: { userUuid_lessonUuid: { userUuid, lessonUuid } },
      create: {
        userUuid,
        lessonUuid,
        isCompleted: true,
        completedAt: new Date(),
        watchedSeconds: 0,
      },
      update: { isCompleted: true, completedAt: new Date() },
    });

    this.logger.log(
      `Lesson manually completed: ${lessonUuid} for user=${userUuid}`,
    );
    await this.checkAndFinalizeCourse(lesson.section.courseUuid, userUuid);

    return { isCompleted: true };
  }

  // ─── CERTIFICATE ──────────────────────────────────────────

  /**
   * Returns certificate URL for a completed course.
   * Generates the certificate if not yet created.
   */
  async getCertificate(courseUuid: string, userUuid: string) {
    const enrollment = await this.prisma.courseEnrollment.findUnique({
      where: { userUuid_courseUuid: { userUuid, courseUuid } },
    });

    if (!enrollment) throw new NotFoundException('Enrollment not found');
    if (!enrollment.completedAt) {
      throw new BadRequestException('Course not completed yet');
    }

    const result = await this.certificateService.getOrGenerate(enrollment.uuid);
    return result;
  }

  // ─── PRIVATE HELPERS ──────────────────────────────────────

  private async requireEnrolledLesson(lessonUuid: string, userUuid: string) {
    const lesson = await this.prisma.courseLesson.findUnique({
      where: { uuid: lessonUuid },
      include: {
        section: { include: { course: true } },
      },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');

    const enrollment = await this.prisma.courseEnrollment.findUnique({
      where: {
        userUuid_courseUuid: {
          userUuid,
          courseUuid: lesson.section.course.uuid,
        },
      },
    });
    if (!enrollment)
      throw new ForbiddenException('You are not enrolled in this course');

    return lesson;
  }

  private async isLessonLocked(
    lesson: {
      uuid: string;
      order: number;
      sectionUuid: string;
      section: { courseUuid: string };
    },
    userUuid: string,
  ): Promise<boolean> {
    // Get all lessons in the course ordered
    const allLessons = await this.prisma.courseLesson.findMany({
      where: { section: { courseUuid: lesson.section.courseUuid } },
      orderBy: [{ section: { order: 'asc' } }, { order: 'asc' }],
      select: { uuid: true },
    });

    const lessonIndex = allLessons.findIndex((l) => l.uuid === lesson.uuid);
    if (lessonIndex <= 0) return false; // First lesson is never locked

    const previousLesson = allLessons[lessonIndex - 1];
    if (!previousLesson) return false;

    const prevProgress = await this.prisma.lessonProgress.findUnique({
      where: {
        userUuid_lessonUuid: { userUuid, lessonUuid: previousLesson.uuid },
      },
    });

    return !(prevProgress?.isCompleted ?? false);
  }

  private async checkAndFinalizeCourse(
    courseUuid: string,
    userUuid: string,
  ): Promise<void> {
    const enrollment = await this.prisma.courseEnrollment.findUnique({
      where: { userUuid_courseUuid: { userUuid, courseUuid } },
    });
    if (!enrollment || enrollment.completedAt) return;

    const allLessons = await this.prisma.courseLesson.findMany({
      where: {
        section: { courseUuid },
        isPublished: true,
      },
      select: { uuid: true },
    });
    if (allLessons.length === 0) return;

    const completedCount = await this.prisma.lessonProgress.count({
      where: {
        userUuid,
        lessonUuid: { in: allLessons.map((l) => l.uuid) },
        isCompleted: true,
      },
    });

    if (completedCount >= allLessons.length) {
      const now = new Date();
      await this.prisma.courseEnrollment.update({
        where: { uuid: enrollment.uuid },
        data: { completedAt: now },
      });

      this.logger.log(
        `Course completed: course=${courseUuid} user=${userUuid}`,
      );

      // Fire-and-forget certificate generation
      this.certificateService.generateForEnrollment(enrollment.uuid);
    }
  }

  /**
   * Builds a map of courseUuid → completion percentage for a user's enrolled courses.
   */
  private async buildProgressMap(
    userUuid: string,
    courseUuids: string[],
    courses: Array<{
      uuid: string;
      sections: Array<{ _count: { lessons: number } }>;
    }>,
  ): Promise<Map<string, number>> {
    if (courseUuids.length === 0) return new Map();

    const allLessonUuidsByCourse = new Map<string, string[]>();
    const coursesWithLessons = await this.prisma.course.findMany({
      where: { uuid: { in: courseUuids } },
      include: {
        sections: {
          include: { lessons: { select: { uuid: true } } },
        },
      },
    });

    for (const course of coursesWithLessons) {
      const uuids = course.sections.flatMap((s) =>
        s.lessons.map((l) => l.uuid),
      );
      allLessonUuidsByCourse.set(course.uuid, uuids);
    }

    const allLessonUuids = [...allLessonUuidsByCourse.values()].flat();
    const progressRecords =
      allLessonUuids.length > 0
        ? await this.prisma.lessonProgress.findMany({
            where: {
              userUuid,
              lessonUuid: { in: allLessonUuids },
              isCompleted: true,
            },
            select: { lessonUuid: true },
            take: 500,
          })
        : [];

    const completedSet = new Set(progressRecords.map((p) => p.lessonUuid));
    const progressMap = new Map<string, number>();

    for (const [cUuid, lessonUuids] of allLessonUuidsByCourse) {
      const total = lessonUuids.length;
      const completed = lessonUuids.filter((u) => completedSet.has(u)).length;
      progressMap.set(
        cUuid,
        total > 0 ? Math.round((completed / total) * 100) : 0,
      );
    }

    // Suppress unused warning — courses param is used by callers for totalSections/lessons
    void courses;
    return progressMap;
  }
}
