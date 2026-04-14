
import {
  IsIn,
  IsOptional,
  IsString,
  IsDateString,
  ValidateIf,
} from 'class-validator';
import { LeadStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdminUpdateLeadStatusDto {
  @ApiProperty({ example: 'FOLLOWUP', enum: ['CONTACTED', 'FOLLOWUP', 'MARK_AS_CUSTOMER', 'LOST'], description: 'New lead status' })
  @IsIn([
    LeadStatus.CONTACTED,
    LeadStatus.FOLLOWUP,
    LeadStatus.MARK_AS_CUSTOMER,
    LeadStatus.LOST,
  ])
  status: LeadStatus;

  @ApiPropertyOptional({ example: 'Interested, calling back on Monday', description: 'Optional notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  /**
   * Required when status === FOLLOWUP.
   * Must be a future date-time (ISO 8601 string).
   */
  @ApiPropertyOptional({ example: '2026-04-15T10:00:00.000Z', description: 'Follow-up datetime (required when status=FOLLOWUP)' })
  @ValidateIf((o) => o.status === LeadStatus.FOLLOWUP)
  @IsDateString()
  followupAt?: string;

  /**
   * Returns followupAt as a Date object (after transform).
   * The DTO accepts ISO string from JSON but we expose Date for service use.
   */
  get followupAtDate(): Date | undefined {
    return this.followupAt ? new Date(this.followupAt) : undefined;
  }
}
