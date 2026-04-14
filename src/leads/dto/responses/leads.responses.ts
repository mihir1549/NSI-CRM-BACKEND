import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LeadUserReference {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  uuid!: string;

  @ApiProperty({ example: 'Jane Doe' })
  fullName!: string;

  @ApiProperty({ example: 'jane@example.com' })
  email!: string;

  @ApiPropertyOptional({ example: 'US' })
  country!: string | null;

  @ApiPropertyOptional({ example: 'https://avatar.url' })
  avatarUrl!: string | null;
}

export class LeadActivityActor {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  uuid!: string;

  @ApiProperty({ example: 'John Admin' })
  fullName!: string;
}

export class LeadActivityResponse {
  @ApiProperty({ example: 'act_123' })
  uuid!: string;

  @ApiProperty({ example: 'STATUS_CHANGE' })
  action!: string;

  @ApiPropertyOptional({ example: 'NEW' })
  fromStatus!: string | null;

  @ApiPropertyOptional({ example: 'WARM' })
  toStatus!: string | null;

  @ApiPropertyOptional({ example: 'Called user, they are interested' })
  notes!: string | null;

  @ApiPropertyOptional({ example: '2026-04-12T14:30:00.000Z' })
  followupAt!: Date | null;

  @ApiPropertyOptional({ type: LeadActivityActor })
  actor?: LeadActivityActor;

  @ApiProperty({ example: '2026-04-11T14:30:00.000Z' })
  createdAt!: Date;
}

export class LeadItemResponse {
  @ApiProperty({ example: 'lead_123' })
  uuid!: string;

  @ApiProperty({ example: 'user_123' })
  userUuid!: string;

  @ApiPropertyOptional({ example: 'dist_123' })
  distributorUuid!: string | null;

  @ApiProperty({ example: 'admin_123' })
  assignedToUuid!: string;

  @ApiProperty({ example: 'WARM' })
  status!: string;

  @ApiProperty({ example: 'WARM' })
  displayStatus!: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  phone!: string | null;

  @ApiProperty({ example: '2026-04-11T14:30:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-04-11T14:30:00.000Z' })
  updatedAt!: Date;

  @ApiProperty({ type: LeadUserReference })
  user!: LeadUserReference;

  @ApiPropertyOptional({ type: LeadActivityActor })
  assignedTo?: LeadActivityActor;
}

export class LeadListResponse {
  @ApiProperty({ type: [LeadItemResponse] })
  items!: LeadItemResponse[];

  @ApiProperty({ example: 45 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}

export class LeadFunnelProgress {
  @ApiProperty({ example: true })
  phoneVerified!: boolean;

  @ApiProperty({ example: true })
  paymentCompleted!: boolean;

  @ApiPropertyOptional({ example: 'YES' })
  decisionAnswer!: string | null;

  @ApiProperty({ example: 3 })
  completedSteps!: number;

  @ApiProperty({ example: 5 })
  totalSteps!: number;

  @ApiPropertyOptional({ example: 'step_123' })
  currentStepUuid!: string | null;
}

export class LeadPaymentInfo {
  @ApiProperty({ example: 'pay_123' })
  uuid!: string;

  @ApiProperty({ example: 999 })
  amount!: number;

  @ApiProperty({ example: 999 })
  finalAmount!: number;

  @ApiProperty({ example: 'INR' })
  currency!: string;

  @ApiProperty({ example: 'SUCCESS' })
  status!: string;

  @ApiProperty({ example: 'COMMITMENT_FEE' })
  paymentType!: string;

  @ApiProperty({ example: '2026-04-11T14:30:00.000Z' })
  createdAt!: Date;
}

export class LeadDetailResponse extends LeadItemResponse {
  @ApiProperty({ type: [LeadActivityResponse] })
  activities!: LeadActivityResponse[];

  @ApiPropertyOptional({ type: LeadFunnelProgress })
  funnelProgress?: LeadFunnelProgress | null;

  @ApiPropertyOptional({ type: [LeadPaymentInfo] })
  payments?: LeadPaymentInfo[];

  @ApiPropertyOptional({ type: LeadActivityActor })
  distributor?: LeadActivityActor;
}

export class FollowupNotificationItem {
  @ApiProperty({ example: 'lead_123' })
  leadUuid!: string;

  @ApiProperty({ example: 'Jane Doe' })
  userFullName!: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  phone!: string | null;

  @ApiProperty({ example: '2026-04-11T14:30:00.000Z' })
  followupAt!: Date;

  @ApiPropertyOptional({ example: 'Call again' })
  notes!: string | null;
}

export class AdminNotificationsResponse {
  @ApiProperty({ type: [FollowupNotificationItem] })
  followupsToday!: FollowupNotificationItem[];

  @ApiProperty({ type: [FollowupNotificationItem] })
  overdueFollowups!: FollowupNotificationItem[];
}
