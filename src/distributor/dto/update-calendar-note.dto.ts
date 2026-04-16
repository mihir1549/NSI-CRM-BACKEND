import {
  IsString,
  IsDateString,
  IsOptional,
  IsNotEmpty,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCalendarNoteDto {
  @ApiPropertyOptional({
    example: 'Team meeting at 3pm',
    description: 'Note content',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  note?: string;

  @ApiPropertyOptional({
    example: '14:30',
    description: 'Optional time in HH:mm format',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Time must be in HH:mm format (e.g. "14:30")',
  })
  time?: string;

  @ApiPropertyOptional({
    example: '2026-04-15',
    description: 'Date to move the note to',
  })
  @IsOptional()
  @IsDateString()
  date?: string;
}
