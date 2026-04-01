import {
  IsEnum,
  IsInt,
  IsOptional,
  IsBoolean,
  IsString,
  Min,
} from 'class-validator';
import { StepType } from '@prisma/client';

export class CreateStepDto {
  @IsString()
  sectionUuid!: string;

  @IsEnum(StepType)
  type!: StepType;

  @IsInt()
  @Min(1)
  order!: number;
}

export class UpdateStepDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  order?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
