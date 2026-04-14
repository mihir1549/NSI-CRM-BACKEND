import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CourseAdminLessonResponse {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  uuid!: string;

  @ApiProperty({ example: 'Introduction to the Course' })
  title!: string;

  @ApiPropertyOptional({ example: 'Learn the basics' })
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
  isPublished!: boolean;
}

export class CourseAdminSectionResponse {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  uuid!: string;

  @ApiProperty({ example: 'Module 1' })
  title!: string;

  @ApiProperty({ example: 1 })
  order!: number;

  @ApiProperty({ type: [CourseAdminLessonResponse] })
  lessons!: CourseAdminLessonResponse[];
}

export class CourseAdminListResponse {
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

  @ApiProperty({ example: true })
  isPublished!: boolean;

  @ApiPropertyOptional({ example: 'Bestseller' })
  badge!: string | null;

  @ApiProperty({ example: '2026-04-10T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: 150 })
  totalEnrollments!: number;

  @ApiProperty({ example: 25 })
  totalLessons!: number;
}

export class CourseAdminDetailResponse extends CourseAdminListResponse {
  @ApiPropertyOptional({ example: 'https://preview.video' })
  previewVideoUrl!: string | null;

  @ApiProperty({ example: ['John Doe'] })
  instructors!: string[];

  @ApiProperty({ example: ['Water health benefits'] })
  whatYouWillLearn!: string[];

  @ApiPropertyOptional({ example: 1999 })
  originalPrice!: number | null;

  @ApiPropertyOptional({ example: 1200 })
  totalDuration!: number | null;

  @ApiProperty({ example: 50 })
  enrollmentBoost!: number;

  @ApiProperty({ example: 5 })
  totalSections!: number;

  @ApiProperty({ example: 10 })
  totalPdfs!: number;

  @ApiPropertyOptional({ example: 50 })
  discountPercent!: number | null;

  @ApiProperty({ type: [CourseAdminSectionResponse] })
  sections!: CourseAdminSectionResponse[];
}

export class CourseAdminUpdateResponse {
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

  @ApiPropertyOptional({ example: 'https://preview.video' })
  previewVideoUrl!: string | null;

  @ApiPropertyOptional({ example: 'Bestseller' })
  badge!: string | null;

  @ApiProperty({ example: ['John Doe'] })
  instructors!: string[];

  @ApiProperty({ example: ['Water health benefits'] })
  whatYouWillLearn!: string[];

  @ApiPropertyOptional({ example: 1999 })
  originalPrice!: number | null;

  @ApiPropertyOptional({ example: 1200 })
  totalDuration!: number | null;

  @ApiProperty({ example: 50 })
  enrollmentBoost!: number;
}

export class SectionAdminUpdateResponse {
  @ApiProperty({ example: 'Module 1' })
  title!: string;

  @ApiProperty({ example: 1 })
  order!: number;
}

export class LessonAdminUpdateResponse {
  @ApiProperty({ example: 'Introduction to the Course' })
  title!: string;

  @ApiPropertyOptional({ example: 'Learn the basics' })
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
  isPublished!: boolean;
}

export class CourseBreakdownStats {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  uuid!: string;

  @ApiProperty({ example: 'Kangen Water' })
  title!: string;

  @ApiProperty({ example: false })
  isFree!: boolean;

  @ApiProperty({ example: 150 })
  enrollments!: number;

  @ApiProperty({ example: 50 })
  completions!: number;

  @ApiProperty({ example: '33.3%' })
  completionRate!: string;

  @ApiProperty({ example: 45 })
  avgProgress!: number;
}

export class LmsAnalyticsResponse {
  @ApiProperty({ example: 10 })
  totalCourses!: number;

  @ApiProperty({ example: 8 })
  publishedCourses!: number;

  @ApiProperty({ example: 1000 })
  totalEnrollments!: number;

  @ApiProperty({ example: 250 })
  totalCompletions!: number;

  @ApiProperty({ example: '25.0%' })
  completionRate!: string;

  @ApiProperty({ example: 250 })
  certificatesIssued!: number;

  @ApiProperty({ type: [CourseBreakdownStats] })
  courseBreakdown!: CourseBreakdownStats[];
}

export class UploadResponse {
  @ApiProperty({ example: 'https://cloudinary.url/file' })
  url!: string;
}
