import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUrl,
  IsBoolean,
  IsNumber,
  IsInt,
  IsArray,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCourseDto {
  @ApiPropertyOptional({ example: 'Kangen Water Business Masterclass', description: 'Course title' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @ApiPropertyOptional({ example: 'Learn how to build a Kangen Water distribution business.', description: 'Course description' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @ApiPropertyOptional({ example: 'https://r2-url/nsi-thumbnails/UPLOAD-xxx.jpg', description: 'Thumbnail image URL' })
  @IsOptional()
  @IsUrl()
  thumbnailUrl?: string;

  @ApiPropertyOptional({ example: false, description: 'Whether the course is free' })
  @IsOptional()
  @IsBoolean()
  isFree?: boolean;

  @ApiPropertyOptional({ example: 999, description: 'Course price in rupees', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: 'https://bunny.net/embed/xxx', description: 'Preview video URL' })
  @IsOptional()
  @IsUrl()
  previewVideoUrl?: string;

  @ApiPropertyOptional({ example: 'BESTSELLER', description: 'Badge label' })
  @IsOptional()
  @IsString()
  badge?: string;

  @ApiPropertyOptional({ example: ['Nageshwar Shukla'], description: 'Instructor names', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  instructors?: string[];

  @ApiPropertyOptional({ example: ['Build a team', 'Master Kangen science'], description: 'Learning outcomes', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  whatYouWillLearn?: string[];

  @ApiPropertyOptional({ example: 1999, description: 'Original price before discount', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  originalPrice?: number;

  @ApiPropertyOptional({ example: '12h 30m', description: 'Human-readable total duration' })
  @IsOptional()
  @IsString()
  totalDuration?: string;

  @ApiPropertyOptional({ example: 50, description: 'Artificial enrollment boost count', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  enrollmentBoost?: number;
}
