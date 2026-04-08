import { IsString, IsOptional, IsUUID, IsDateString, MaxLength } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsUUID()
  leadUuid?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
