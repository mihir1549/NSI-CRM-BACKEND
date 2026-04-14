import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUrl,
  IsInt,
  Min,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLessonDto {
  @ApiProperty({ example: 'Introduction to Kangen Water Science', description: 'Lesson title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'Overview of ionized alkaline water and its benefits.', description: 'Lesson description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'https://bunny.net/embed/abc123', description: 'Bunny.net video embed URL' })
  @IsOptional()
  @IsUrl()
  videoUrl?: string;

  @ApiPropertyOptional({ example: 1800, description: 'Video duration in seconds', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  videoDuration?: number;

  @ApiPropertyOptional({ example: '<p>Lesson notes here...</p>', description: 'HTML text content' })
  @IsOptional()
  @IsString()
  textContent?: string;

  @ApiPropertyOptional({ example: 'https://r2-url/nsi-lms-pdfs/lesson.pdf', description: 'PDF URL (legacy)' })
  @IsOptional()
  @IsString()
  pdfUrl?: string;

  @ApiProperty({ example: 1, description: 'Display order within section', minimum: 1 })
  @IsInt()
  @Min(1)
  order: number;

  @ApiProperty({ example: true, description: 'Whether the lesson is published' })
  @IsBoolean()
  isPublished: boolean;

  @ApiPropertyOptional({ example: false, description: 'Whether non-enrolled users can preview this lesson' })
  @IsOptional()
  @IsBoolean()
  isPreview?: boolean;

  @ApiPropertyOptional({ example: 'https://r2-url/nsi-attachments/UPLOAD-xxx.pdf', description: 'Attachment file URL' })
  @IsOptional()
  @IsUrl()
  attachmentUrl?: string;

  @ApiPropertyOptional({ example: 'Lesson Slides.pdf', description: 'Attachment display name' })
  @IsOptional()
  @IsString()
  attachmentName?: string;
}
