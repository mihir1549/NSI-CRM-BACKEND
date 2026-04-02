import { IsInt, Min } from 'class-validator';

export class LessonProgressDto {
  @IsInt()
  @Min(0)
  watchedSeconds: number;
}
