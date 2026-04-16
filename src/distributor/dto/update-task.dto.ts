import {
  IsString,
  IsOptional,
  IsUUID,
  IsDateString,
  IsIn,
  IsInt,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTaskDto {
  @ApiPropertyOptional({
    example: 'Follow up with Rajesh about membership',
    description: 'Task title (max 200 chars)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Associated lead UUID',
  })
  @IsOptional()
  @IsUUID()
  leadUuid?: string;

  @ApiPropertyOptional({
    example: '2026-04-15T00:00:00.000Z',
    description: 'Due date (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({
    example: 'IN_PROGRESS',
    enum: ['TODO', 'IN_PROGRESS', 'COMPLETE'],
    description: 'Task status',
  })
  @IsOptional()
  @IsIn(['TODO', 'IN_PROGRESS', 'COMPLETE'])
  status?: string;

  @ApiPropertyOptional({
    example: 0,
    description: 'Display order position',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
