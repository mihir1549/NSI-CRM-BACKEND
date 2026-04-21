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
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCourseDto {
  @ApiProperty({
    example: 'Kangen Water Business Masterclass',
    description: 'Course title',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example:
      'Learn how to build a Kangen Water distribution business from scratch.',
    description: 'Course description',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({
    example: 'https://r2-url/nsi-thumbnails/UPLOAD-xxx.jpg',
    description: 'Thumbnail image URL',
  })
  @IsOptional()
  @IsUrl()
  thumbnailUrl?: string;

  @ApiProperty({ example: false, description: 'Whether the course is free' })
  @IsBoolean()
  isFree: boolean;

  @ApiPropertyOptional({
    example: 999,
    description: 'Course price in rupees (required when isFree=false)',
    minimum: 0,
  })
  @ValidateIf((o: CreateCourseDto) => !o.isFree)
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({
    example: 'https://bunny.net/embed/xxx',
    description: 'Preview video URL',
  })
  @IsOptional()
  @IsUrl()
  previewVideoUrl?: string;

  @ApiPropertyOptional({
    example: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    description: 'Bunny Stream video GUID for course preview',
  })
  @IsOptional()
  @IsString()
  previewBunnyVideoId?: string | null;

  @ApiPropertyOptional({
    example: 'BESTSELLER',
    description: 'Badge label shown on course card',
  })
  @IsOptional()
  @IsString()
  badge?: string;

  @ApiPropertyOptional({
    example: ['Nageshwar Shukla', 'Dr. Patel'],
    description: 'Instructor names',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  instructors?: string[];

  @ApiPropertyOptional({
    example: ['Build a team', 'Master Kangen science'],
    description: 'Learning outcomes',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  whatYouWillLearn?: string[];

  @ApiPropertyOptional({
    example: 1999,
    description: 'Original price before discount (rupees)',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  originalPrice?: number;

  @ApiPropertyOptional({
    example: '12h 30m',
    description: 'Human-readable total duration',
  })
  @IsOptional()
  @IsString()
  totalDuration?: string;

  @ApiPropertyOptional({
    example: 50,
    description: 'Artificial boost added to displayed enrollment count',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  enrollmentBoost?: number;
}
