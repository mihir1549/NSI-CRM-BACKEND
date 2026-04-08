import { IsString, IsOptional, IsUUID, IsDateString, IsIn, IsInt, Min, MaxLength } from 'class-validator';

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsUUID()
  leadUuid?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsIn(['TODO', 'IN_PROGRESS', 'COMPLETE'])
  status?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
