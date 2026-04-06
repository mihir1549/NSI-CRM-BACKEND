
import {
  IsIn,
  IsOptional,
  IsString,
  IsDateString,
  ValidateIf,
} from 'class-validator';
import { LeadStatus } from '@prisma/client';

export class AdminUpdateLeadStatusDto {
  @IsIn([
    LeadStatus.CONTACTED,
    LeadStatus.FOLLOWUP,
    LeadStatus.MARK_AS_CUSTOMER,
    LeadStatus.LOST,
  ])
  status: LeadStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  /**
   * Required when status === FOLLOWUP.
   * Must be a future date-time (ISO 8601 string).
   */
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
