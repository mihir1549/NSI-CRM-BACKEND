import { IsString, IsNotEmpty, IsInt, Min, IsOptional } from 'class-validator';

export class UpdateSectionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  order?: number;
}
