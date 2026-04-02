import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUrl,
  IsInt,
  Min,
  IsBoolean,
} from 'class-validator';

export class UpdateLessonDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

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

  @IsOptional()
  @IsInt()
  @Min(1)
  order?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
