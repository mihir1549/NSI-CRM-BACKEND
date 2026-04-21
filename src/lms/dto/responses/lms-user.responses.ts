import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CourseUserListResponse {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  uuid!: string;

  @ApiProperty({ example: 'Kangen Water Masterclass' })
  title!: string;

  @ApiPropertyOptional({ example: 'Learn everything about Kangen water' })
  description!: string | null;

  @ApiPropertyOptional({ example: 'https://image.url' })
  thumbnailUrl!: string | null;

  @ApiProperty({ example: false })
  isFree!: boolean;

  @ApiProperty({ example: 999 })
  price!: number;

  @ApiPropertyOptional({ example: 'Bestseller' })
  badge!: string | null;

  @ApiPropertyOptional({ example: 1200 })
  totalDuration!: number | null;

  @ApiPropertyOptional({ example: 'https://preview.video' })
  previewVideoUrl!: string | null;

  @ApiProperty({ example: ['John Doe'] })
  instructors!: string[];

  @ApiProperty({ example: ['Water health benefits'] })
  whatYouWillLearn!: string[];

  @ApiPropertyOptional({ example: 1999 })
  originalPrice!: number | null;

  @ApiPropertyOptional({ example: 50 })
  discountPercent!: number | null;

  @ApiProperty({ example: 5 })
  totalSections!: number;

  @ApiProperty({ example: 25 })
  totalLessons!: number;

  @ApiProperty({ example: 150 })
  displayEnrollmentCount!: number;

  @ApiProperty({ example: true })
  isEnrolled!: boolean;

  @ApiPropertyOptional({ example: 45 })
  progress!: number | null;
}

export class LessonUserDetailResponse {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  uuid!: string;

  @ApiProperty({ example: 'Intro to Water' })
  title!: string;

  @ApiProperty({ example: 1 })
  order!: number;

  @ApiPropertyOptional({ example: 120 })
  videoDuration!: number | null;

  @ApiProperty({ example: false })
  isPreview!: boolean;

  @ApiPropertyOptional({ example: false })
  isCompleted?: boolean;

  @ApiPropertyOptional({ example: false })
  isLocked?: boolean;

  @ApiPropertyOptional({ example: 'https://video.url' })
  videoUrl?: string | null;

  @ApiPropertyOptional({ example: '<p>HTML content</p>' })
  textContent?: string | null;

  @ApiPropertyOptional({ example: 'https://attachment.url' })
  attachmentUrl?: string | null;

  @ApiPropertyOptional({ example: 'worksheet.pdf' })
  attachmentName?: string | null;

  @ApiPropertyOptional({ example: 'cccccccc-cccc-cccc-cccc-cccccccccccc' })
  bunnyVideoId?: string | null;

  @ApiPropertyOptional({ example: 'bunny', enum: ['bunny', 'direct'] })
  videoProvider?: 'bunny' | 'direct';

  @ApiPropertyOptional({ example: 1713590000 })
  videoExpiry?: number | null;
}

export class SectionUserDetailResponse {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  uuid!: string;

  @ApiProperty({ example: 'Module 1' })
  title!: string;

  @ApiProperty({ example: 1 })
  order!: number;

  @ApiProperty({ type: [LessonUserDetailResponse] })
  lessons!: LessonUserDetailResponse[];
}

export class EnrollmentDto {
  @ApiProperty({ example: '2026-04-10T00:00:00.000Z' })
  enrolledAt!: Date;

  @ApiPropertyOptional({ example: '2026-04-11T00:00:00.000Z' })
  completedAt!: Date | null;

  @ApiProperty({ example: 45 })
  progress!: number;
}

export class CourseUserDetailResponse {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  uuid!: string;

  @ApiProperty({ example: 'Kangen Water Masterclass' })
  title!: string;

  @ApiPropertyOptional({ example: 'Learn everything about Kangen water' })
  description!: string | null;

  @ApiPropertyOptional({ example: 'https://image.url' })
  thumbnailUrl!: string | null;

  @ApiProperty({ example: false })
  isFree!: boolean;

  @ApiProperty({ example: 999 })
  price!: number;

  @ApiPropertyOptional({ example: 'Bestseller' })
  badge!: string | null;

  @ApiPropertyOptional({ example: 1200 })
  totalDuration!: number | null;

  @ApiPropertyOptional({ example: 'https://preview.video' })
  previewVideoUrl!: string | null;

  @ApiProperty({ example: ['John Doe'] })
  instructors!: string[];

  @ApiProperty({ example: ['Water health benefits'] })
  whatYouWillLearn!: string[];

  @ApiPropertyOptional({ example: 1999 })
  originalPrice!: number | null;

  @ApiPropertyOptional({ example: 50 })
  discountPercent!: number | null;

  @ApiProperty({ example: 25 })
  totalLessons!: number;

  @ApiProperty({ example: 150 })
  displayEnrollmentCount!: number;

  @ApiPropertyOptional({ type: EnrollmentDto })
  enrollment!: EnrollmentDto | null;

  @ApiProperty({ type: [SectionUserDetailResponse] })
  sections!: SectionUserDetailResponse[];
}

export class LessonLearnResponse {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  uuid!: string;

  @ApiProperty({ example: 'Intro to Water' })
  title!: string;

  @ApiPropertyOptional({ example: 'Description here' })
  description!: string | null;

  @ApiPropertyOptional({ example: 'https://video.url' })
  videoUrl!: string | null;

  @ApiPropertyOptional({ example: 120 })
  videoDuration!: number | null;

  @ApiPropertyOptional({ example: '<p>HTML content</p>' })
  textContent!: string | null;

  @ApiPropertyOptional({ example: 'https://pdf.url' })
  pdfUrl!: string | null;

  @ApiProperty({ example: false })
  isPreview!: boolean;

  @ApiPropertyOptional({ example: 'https://attachment.url' })
  attachmentUrl!: string | null;

  @ApiPropertyOptional({ example: 'worksheet.pdf' })
  attachmentName!: string | null;

  @ApiProperty({ example: 1 })
  order!: number;

  @ApiProperty({ example: true })
  isCompleted!: boolean;

  @ApiProperty({ example: 60 })
  watchedSeconds!: number;

  @ApiProperty({ example: false })
  isLocked!: boolean;

  @ApiPropertyOptional({ example: 'cccccccc-cccc-cccc-cccc-cccccccccccc' })
  bunnyVideoId?: string | null;

  @ApiPropertyOptional({ example: 'bunny', enum: ['bunny', 'direct'] })
  videoProvider?: 'bunny' | 'direct';

  @ApiPropertyOptional({ example: 1713590000 })
  videoExpiry?: number | null;
}

export class SectionLearnResponse {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  uuid!: string;

  @ApiProperty({ example: 'Module 1' })
  title!: string;

  @ApiProperty({ example: 1 })
  order!: number;

  @ApiProperty({ type: [LessonLearnResponse] })
  lessons!: LessonLearnResponse[];
}

export class CourseUserLearnResponse {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  uuid!: string;

  @ApiProperty({ example: 'Kangen Water Masterclass' })
  title!: string;

  @ApiPropertyOptional({ example: 'Learn everything about Kangen water' })
  description!: string | null;

  @ApiPropertyOptional({ example: 'https://image.url' })
  thumbnailUrl!: string | null;

  @ApiProperty({ type: [SectionLearnResponse] })
  sections!: SectionLearnResponse[];
}

export class MyCourseResponse {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  uuid!: string;

  @ApiProperty({ example: 'Kangen Water Masterclass' })
  title!: string;

  @ApiPropertyOptional({ example: 'https://image.url' })
  thumbnailUrl!: string | null;

  @ApiProperty({ example: '2026-04-10T00:00:00.000Z' })
  enrolledAt!: Date;

  @ApiPropertyOptional({ example: '2026-04-11T00:00:00.000Z' })
  completedAt!: Date | null;

  @ApiProperty({ example: 45 })
  progress!: number;

  @ApiPropertyOptional({ example: 'https://certificate.url' })
  certificateUrl!: string | null;

  @ApiProperty({ example: 25 })
  totalLessons!: number;

  @ApiProperty({ example: 15 })
  completedLessons!: number;

  @ApiPropertyOptional({ example: '2026-04-10T00:00:00.000Z' })
  lastActivityAt!: Date | null;
}

export class MyCoursesListResponse {
  @ApiProperty({ type: [MyCourseResponse] })
  courses!: MyCourseResponse[];
}

export class LessonProgressResponse {
  @ApiProperty({ example: true })
  isCompleted!: boolean;

  @ApiProperty({ example: 60 })
  watchedSeconds!: number;
}

export class LessonCompleteResponse {
  @ApiProperty({ example: true })
  isCompleted!: boolean;
}

export class EnrollmentResponse {
  @ApiProperty({ example: 'free_course_enrolled' })
  message!: string;
}

export class CertificateResponse {
  @ApiProperty({ example: 'https://r2.file.url/cert.pdf' })
  certificateUrl!: string;
}

export class LessonTokenResponse {
  @ApiProperty({ example: 'https://video-signed.url' })
  videoUrl!: string;

  @ApiProperty({ example: 1713590000 })
  videoExpiry!: number;
}
