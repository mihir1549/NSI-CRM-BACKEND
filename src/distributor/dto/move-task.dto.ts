import { IsIn, IsInt, Min } from 'class-validator';

export class MoveTaskDto {
  @IsIn(['TODO', 'IN_PROGRESS', 'COMPLETE'])
  status: string;

  @IsInt()
  @Min(0)
  order: number;
}
