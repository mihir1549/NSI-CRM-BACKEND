import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUrl,
  IsInt,
  Min,
  IsBoolean,
} from 'class-validator';

export class CreateLessonDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl()
  videoUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  videoDuration?: number;

  @IsOptional()
  @IsString()
  textContent?: string;

  @IsOptional()
  @IsUrl()
  pdfUrl?: string;

  @IsInt()
  @Min(1)
  order: number;

  @IsBoolean()
  isPublished: boolean;
}
