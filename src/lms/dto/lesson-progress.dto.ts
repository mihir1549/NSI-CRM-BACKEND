import { IsInt, Min, Max } from 'class-validator';

export class LessonProgressDto {
  @IsInt()
  @Min(0)
  @Max(86400)
  watchedSeconds: number;
}
