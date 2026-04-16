import { IsString, IsOptional, IsInt, IsBoolean, Min } from 'class-validator';

export class CreateSectionDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(1)
  order!: number;
}

export class UpdateSectionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  order?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ReorderItemDto {
  @IsString()
  uuid!: string;

  @IsInt()
  @Min(1)
  order!: number;
}
