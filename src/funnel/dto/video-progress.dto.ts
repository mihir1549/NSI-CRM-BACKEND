import { IsInt, Min } from 'class-validator';

export class VideoProgressDto {
  @IsInt()
  @Min(0)
  watchedSeconds!: number;
}
