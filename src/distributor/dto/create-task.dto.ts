import { IsString, IsOptional, IsUUID, IsDateString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTaskDto {
  @ApiProperty({ example: 'Follow up with Rajesh about membership', description: 'Task title (max 200 chars)' })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Associated lead UUID' })
  @IsOptional()
  @IsUUID()
  leadUuid?: string;

  @ApiPropertyOptional({ example: '2026-04-15T00:00:00.000Z', description: 'Due date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
