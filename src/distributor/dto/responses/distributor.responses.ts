import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class JoinLinkResponse {
  @ApiProperty({ example: 'NAG2026' })
  code!: string;

  @ApiProperty({ example: 'https://growithnsi.com/join/NAG2026' })
  url!: string;

  @ApiProperty({ example: 'data:image/png;base64,iVBOR...' })
  qrCode!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;
}

export class SubscriptionPlanResponse {
  @ApiProperty({ example: 'Pro' })
  name!: string;

  @ApiProperty({ example: 4999 })
  amount!: number;
}

export class DashboardSubscriptionResponse {
  @ApiProperty({ example: 'ACTIVE' })
  status!: string;

  @ApiProperty({ example: '2026-05-11T00:00:00.000Z' })
  currentPeriodEnd!: Date;

  @ApiPropertyOptional({ example: '2026-05-18T00:00:00.000Z' })
  graceDeadline!: Date | null;

  @ApiProperty({ type: SubscriptionPlanResponse })
  plan!: SubscriptionPlanResponse;
}

export class DashboardResponse {
  @ApiProperty({ example: 45 })
  totalLeads!: number;

  @ApiProperty({ example: 10 })
  hotLeads!: number;

  @ApiProperty({ example: 25 })
  contactedLeads!: number;

  @ApiProperty({ example: 5 })
  customers!: number;

  @ApiProperty({ example: '11.11%' })
  conversionRate!: string;

  @ApiPropertyOptional({ type: DashboardSubscriptionResponse })
  subscription!: DashboardSubscriptionResponse | null;

  @ApiPropertyOptional({ type: JoinLinkResponse })
  joinLink!: JoinLinkResponse | null;
}

export class UtmEntry {
  @ApiProperty({ example: 'facebook' })
  source?: string;

  @ApiProperty({ example: 'cpc' })
  medium?: string;

  @ApiProperty({ example: 'summer_sale' })
  campaign?: string;

  @ApiProperty({ example: 15 })
  leads!: number;
}

export class UtmAnalyticsResponse {
  @ApiProperty({ type: [UtmEntry] })
  bySource!: UtmEntry[];

  @ApiProperty({ type: [UtmEntry] })
  byMedium!: UtmEntry[];

  @ApiProperty({ type: [UtmEntry] })
  byCampaign!: UtmEntry[];

  @ApiProperty({ example: 45 })
  total!: number;

  @ApiProperty({ example: '2026-03-12T00:00:00.000Z' })
  from!: string;

  @ApiProperty({ example: '2026-04-11T23:59:59.999Z' })
  to!: string;
}

export class FunnelDropOff {
  @ApiProperty({ example: 45 })
  registered!: number;

  @ApiProperty({ example: 40 })
  phoneVerified!: number;

  @ApiProperty({ example: 25 })
  paymentCompleted!: number;

  @ApiProperty({ example: 10 })
  saidYes!: number;

  @ApiProperty({ example: 5 })
  saidNo!: number;
}

export class UsersAnalyticsResponse {
  @ApiProperty({ example: 45 })
  totalUsers!: number;

  @ApiProperty({ example: 25 })
  paidUsers!: number;

  @ApiProperty({ example: 20 })
  freeUsers!: number;

  @ApiProperty({ example: 10 })
  hotLeads!: number;

  @ApiProperty({ example: 5 })
  customers!: number;

  @ApiProperty({ example: '11.11%' })
  conversionRate!: string;

  @ApiProperty({ type: FunnelDropOff })
  funnelDropOff!: FunnelDropOff;
}

export class UserFunnelProgress {
  @ApiProperty({ example: 3 })
  completedSteps!: number;

  @ApiProperty({ example: 5 })
  totalSteps!: number;

  @ApiProperty({ example: true })
  phoneVerified!: boolean;

  @ApiProperty({ example: true })
  paymentCompleted!: boolean;

  @ApiPropertyOptional({ example: 'YES' })
  decisionAnswer!: string | null;
}

export class DistributorUserItem {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  uuid!: string;

  @ApiProperty({ example: 'John Doe' })
  fullName!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  phone!: string | null;

  @ApiPropertyOptional({ example: 'IN' })
  country!: string | null;

  @ApiPropertyOptional({ example: 'https://avatar.url' })
  avatarUrl!: string | null;

  @ApiProperty({ example: 'CUSTOMER' })
  role!: string;

  @ApiProperty({ example: 'ACTIVE' })
  status!: string;

  @ApiProperty({ example: '2026-04-10T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: 'HOT' })
  leadStatus!: string;

  @ApiProperty({ example: 'Hot' })
  displayLeadStatus!: string;

  @ApiProperty({ example: 'Paid' })
  paymentStatus!: string;

  @ApiProperty({ example: 'SAID_YES' })
  funnelStage!: string;

  @ApiProperty({ example: 'Said YES' })
  funnelStageLabel!: string;

  @ApiProperty({ type: UserFunnelProgress })
  funnelProgress!: UserFunnelProgress;
}

export class UsersListResponse {
  @ApiProperty({ type: [DistributorUserItem] })
  items!: DistributorUserItem[];

  @ApiProperty({ example: 45 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}

export class SubscribeResponse {
  @ApiProperty({ example: 'sub_123456789' })
  subscriptionId!: string;

  @ApiPropertyOptional({ example: 'https://rzp.io/i/sub_12345' })
  shortUrl!: string | null;
}

export class MySubscriptionResponse {
  @ApiProperty({ example: 'ACTIVE' })
  status!: string;

  @ApiPropertyOptional({ example: '2026-05-11T00:00:00.000Z' })
  currentPeriodEnd?: Date;

  @ApiPropertyOptional({ example: '2026-05-18T00:00:00.000Z' })
  graceDeadline?: Date | null;

  @ApiPropertyOptional({ example: false })
  migrationPending?: boolean;

  @ApiPropertyOptional({ example: '2026-05-11T00:00:00.000Z' })
  planDeactivatedAt?: Date | null;

  @ApiPropertyOptional({ type: SubscriptionPlanResponse })
  plan?: SubscriptionPlanResponse;

  @ApiPropertyOptional({ example: 'No subscription record found' })
  message?: string;
}

export class PaymentMethodUrlResponse {
  @ApiProperty({ example: 'https://rzp.io/i/sub_12345/update' })
  url!: string;
}

export class SelfCancelResponse {
  @ApiProperty({ example: 'Subscription cancelled successfully' })
  message!: string;

  @ApiProperty({ example: '2026-05-11T00:00:00.000Z' })
  accessUntil!: Date;
}

export class DistTaskLead {
  @ApiProperty({ example: 'lead_uuid' })
  uuid!: string;

  @ApiProperty({ example: 'John Doe' })
  userFullName!: string;

  @ApiPropertyOptional({ example: 'https://avatar.url' })
  userAvatarUrl!: string | null;

  @ApiProperty({ example: 'WARM' })
  status!: string;
}

export class DistributorTaskResponse {
  @ApiProperty({ example: 'task_uuid' })
  uuid!: string;

  @ApiProperty({ example: 'Call John' })
  title!: string;

  @ApiProperty({ example: 'TODO' })
  status!: string;

  @ApiProperty({ example: 1 })
  order!: number;

  @ApiPropertyOptional({ example: '2026-05-11T00:00:00.000Z' })
  dueDate!: Date | null;

  @ApiPropertyOptional({ type: DistTaskLead })
  lead!: DistTaskLead | null;

  @ApiProperty({ example: '2026-04-11T00:00:00.000Z' })
  createdAt!: Date;
}

export class TaskGroupResponse {
  @ApiProperty({ type: [DistributorTaskResponse] })
  TODO!: DistributorTaskResponse[];

  @ApiProperty({ type: [DistributorTaskResponse] })
  IN_PROGRESS!: DistributorTaskResponse[];

  @ApiProperty({ type: [DistributorTaskResponse] })
  COMPLETE!: DistributorTaskResponse[];
}

export class TaskUpdateResponse {
  @ApiProperty({ example: 'Call John' })
  title!: string;

  @ApiPropertyOptional({ example: 'lead_uuid' })
  leadUuid!: string | null;

  @ApiPropertyOptional({ example: '2026-05-11T00:00:00.000Z' })
  dueDate!: string | null;

  @ApiProperty({ example: 'TODO' })
  status!: string;

  @ApiProperty({ example: 1 })
  order!: number;
}

export class SubscriptionHistoryResponse {
  @ApiProperty({ example: 'sub_evt_123' })
  uuid!: string;

  @ApiProperty({ example: 'SUBSCRIBED' })
  event!: string;

  @ApiPropertyOptional({ example: 4999 })
  amount!: number | null;

  @ApiPropertyOptional({ example: 'INV-1234' })
  invoiceNumber!: string | null;

  @ApiPropertyOptional({ example: 'First subscription activated' })
  notes!: string | null;

  @ApiPropertyOptional({ type: SubscriptionPlanResponse })
  plan!: SubscriptionPlanResponse | null;

  @ApiProperty({ example: '2026-04-11T00:00:00.000Z' })
  createdAt!: Date;
}

export class CalendarEventResponse {
  @ApiProperty({ example: '2026-04-11' })
  date!: string;

  @ApiProperty({ example: 'FOLLOWUP' })
  type!: string;

  @ApiProperty({ example: 'Follow up with John Doe' })
  title!: string;

  @ApiPropertyOptional({ example: '14:30:00' })
  time?: string;

  @ApiPropertyOptional({ example: 'lead_uuid' })
  leadUuid?: string;

  @ApiPropertyOptional({ example: 'HOT' })
  leadStatus?: string;

  @ApiPropertyOptional({ example: 'note_uuid' })
  noteUuid?: string;

  @ApiPropertyOptional({ example: 'Remember to ask about X' })
  notes?: string;
}

export class CalendarResponse {
  @ApiProperty({ example: 2026 })
  year!: number;

  @ApiProperty({ example: 4 })
  month!: number;

  @ApiProperty({ type: [CalendarEventResponse] })
  events!: CalendarEventResponse[];
}

export class FollowupTodayResponse {
  @ApiProperty({ example: 'lead_uuid' })
  leadUuid!: string;

  @ApiProperty({ example: 'John Doe' })
  userFullName!: string;

  @ApiProperty({ example: 'HOT' })
  leadStatus!: string;

  @ApiProperty({ example: '2026-04-11T14:30:00.000Z' })
  followupAt!: Date;

  @ApiPropertyOptional({ example: 'Reminder note' })
  notes!: string | null;
}

export class NotificationsResponse {
  @ApiProperty({ type: [DistributorTaskResponse] })
  tasksDueToday!: DistributorTaskResponse[];

  @ApiProperty({ type: [DistributorTaskResponse] })
  tasksDueSoon!: DistributorTaskResponse[];

  @ApiProperty({ type: [FollowupTodayResponse] })
  followupsToday!: FollowupTodayResponse[];

  @ApiProperty({ example: 3 })
  unreadCount!: number;
}
