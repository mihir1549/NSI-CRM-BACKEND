import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUrl,
  IsBoolean,
  IsNumber,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateCourseDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsUrl()
  thumbnailUrl?: string;

  @IsBoolean()
  isFree: boolean;

  // Required when isFree=false
  @ValidateIf((o: CreateCourseDto) => !o.isFree)
  @IsNumber()
  @Min(0)
  price?: number;
}
