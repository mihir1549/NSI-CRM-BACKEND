import { IsString, IsDateString, MaxLength } from 'class-validator';

export class CalendarNoteDto {
  @IsDateString()
  date: string;

  @IsString()
  @MaxLength(1000)
  note: string;
}
