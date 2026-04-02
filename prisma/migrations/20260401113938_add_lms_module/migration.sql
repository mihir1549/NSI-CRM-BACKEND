-- CreateTable
CREATE TABLE "courses" (
    "uuid" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "is_free" BOOLEAN NOT NULL DEFAULT false,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "course_sections" (
    "uuid" TEXT NOT NULL,
    "course_uuid" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_sections_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "course_lessons" (
    "uuid" TEXT NOT NULL,
    "section_uuid" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "video_url" TEXT,
    "video_duration" INTEGER,
    "text_content" TEXT,
    "pdf_url" TEXT,
    "order" INTEGER NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_lessons_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "course_enrollments" (
    "uuid" TEXT NOT NULL,
    "user_uuid" TEXT NOT NULL,
    "course_uuid" TEXT NOT NULL,
    "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "certificate_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "course_enrollments_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "lesson_progress" (
    "uuid" TEXT NOT NULL,
    "user_uuid" TEXT NOT NULL,
    "lesson_uuid" TEXT NOT NULL,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "watched_seconds" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_progress_pkey" PRIMARY KEY ("uuid")
);

-- CreateIndex
CREATE UNIQUE INDEX "course_enrollments_user_uuid_course_uuid_key" ON "course_enrollments"("user_uuid", "course_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_progress_user_uuid_lesson_uuid_key" ON "lesson_progress"("user_uuid", "lesson_uuid");

-- AddForeignKey
ALTER TABLE "course_sections" ADD CONSTRAINT "course_sections_course_uuid_fkey" FOREIGN KEY ("course_uuid") REFERENCES "courses"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_lessons" ADD CONSTRAINT "course_lessons_section_uuid_fkey" FOREIGN KEY ("section_uuid") REFERENCES "course_sections"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_user_uuid_fkey" FOREIGN KEY ("user_uuid") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_course_uuid_fkey" FOREIGN KEY ("course_uuid") REFERENCES "courses"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_user_uuid_fkey" FOREIGN KEY ("user_uuid") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_uuid_fkey" FOREIGN KEY ("lesson_uuid") REFERENCES "course_lessons"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
