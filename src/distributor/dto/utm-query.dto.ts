import { IsDateString, IsOptional } from 'class-validator';

export class UtmQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
