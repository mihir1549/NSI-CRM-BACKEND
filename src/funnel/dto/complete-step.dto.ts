import { IsInt, IsOptional, Min } from 'class-validator';

export class CompleteStepDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  watchedSeconds?: number;
}
