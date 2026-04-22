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

export class DistributorGrowthResponse {
  @ApiProperty({ example: 33.3 })
  leads!: number;

  @ApiProperty({ example: 50.0 })
  customers!: number;

  @ApiProperty({ example: 12.5 })
  conversionRate!: number;
}

export class DistributorDashboardPeriodResponse {
  @ApiProperty({ example: '2026-04-01T00:00:00.000Z' })
  from!: string;

  @ApiProperty({ example: '2026-04-13T23:59:59.999Z' })
  to!: string;

  @ApiProperty({ example: 12 })
  leads!: number;

  @ApiProperty({ example: 3 })
  customers!: number;

  @ApiProperty({ example: 25.0 })
  conversionRate!: number;

  @ApiProperty({ type: DistributorGrowthResponse })
  growth!: DistributorGrowthResponse;
}

export class DistributorTrendPointResponse {
  @ApiProperty({ example: '2026-04-01' })
  date!: string;

  @ApiProperty({ example: 2 })
  leads!: number;

  @ApiProperty({ example: 0 })
  customers!: number;
}

export class DistributorTopCampaignResponse {
  @ApiProperty({ example: 'Instagram Bio' })
  name!: string;

  @ApiProperty({ example: 'insta-bio' })
  slug!: string;

  @ApiProperty({ example: 89 })
  clicks!: number;

  @ApiProperty({ example: 12 })
  signups!: number;

  @ApiProperty({ example: 13.5 })
  conversionRate!: number;
}

export class DashboardLeadsByStatusResponse {
  @ApiProperty({ example: 12 })
  new!: number;

  @ApiProperty({ example: 8 })
  warm!: number;

  @ApiProperty({ example: 5 })
  hot!: number;

  @ApiProperty({ example: 3 })
  contacted!: number;

  @ApiProperty({ example: 2 })
  followUp!: number;

  @ApiProperty({ example: 1 })
  nurture!: number;

  @ApiProperty({ example: 4 })
  lost!: number;

  @ApiProperty({ example: 10 })
  customer!: number;
}

export class DashboardThisMonthResponse {
  @ApiProperty({ example: 15 })
  leads!: number;

  @ApiProperty({ example: 3 })
  customers!: number;

  @ApiProperty({ example: 20 })
  conversionRate!: number;
}

export class DashboardRecentLeadResponse {
  @ApiProperty({ example: 'lead_uuid' })
  uuid!: string;

  @ApiProperty({ example: 'Anita Sharma' })
  name!: string;

  @ApiProperty({ example: 'HOT' })
  status!: string;

  @ApiProperty({ example: '2026-04-21T09:15:00.000Z' })
  createdAt!: string;
}

export class DashboardPlanValueScoreResponse {
  @ApiProperty({ example: 15 })
  leadsThisMonth!: number;

  @ApiProperty({ example: 4999 })
  subscriptionAmount!: number;

  @ApiPropertyOptional({
    example: 333.27,
    description: 'null when leadsThisMonth = 0',
  })
  costPerLead!: number | null;
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

  @ApiProperty({ example: 11.11 })
  conversionRate!: number;

  @ApiProperty({ type: DashboardLeadsByStatusResponse })
  leadsByStatus!: DashboardLeadsByStatusResponse;

  @ApiProperty({ type: DashboardThisMonthResponse })
  thisMonth!: DashboardThisMonthResponse;

  @ApiProperty({ type: [DashboardRecentLeadResponse] })
  recentLeads!: DashboardRecentLeadResponse[];

  @ApiProperty({ type: DashboardPlanValueScoreResponse })
  planValueScore!: DashboardPlanValueScoreResponse;

  @ApiPropertyOptional({ type: DistributorDashboardPeriodResponse })
  period?: DistributorDashboardPeriodResponse | null;

  @ApiPropertyOptional({ type: [DistributorTrendPointResponse] })
  trend?: DistributorTrendPointResponse[];

  @ApiPropertyOptional({ type: [DistributorTopCampaignResponse] })
  topCampaigns?: DistributorTopCampaignResponse[];
}

// ─── Analytics overview (GET /distributor/analytics/overview) ────────────────

export class AnalyticsPipelineStatusResponse {
  @ApiProperty({ example: 'HOT' })
  status!: string;

  @ApiProperty({ example: 5 })
  count!: number;

  @ApiProperty({ example: 11.1 })
  percentage!: number;
}

export class AnalyticsPipelineResponse {
  @ApiProperty({ example: 45 })
  total!: number;

  @ApiProperty({ type: [AnalyticsPipelineStatusResponse] })
  byStatus!: AnalyticsPipelineStatusResponse[];
}

export class AnalyticsCampaignResponse {
  @ApiProperty({ example: 'campaign_uuid' })
  uuid!: string;

  @ApiProperty({ example: 'Instagram Bio' })
  name!: string;

  @ApiProperty({ example: 'insta-bio' })
  slug!: string;

  @ApiProperty({ example: 89 })
  clicks!: number;

  @ApiProperty({ example: 12 })
  signups!: number;

  @ApiProperty({ example: 2 })
  converted!: number;

  @ApiProperty({ example: 16.7 })
  conversionRate!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;
}

export class AnalyticsFunnelDropOffResponse {
  @ApiProperty({ example: 120 })
  visitedJoinLink!: number;

  @ApiProperty({ example: 90 })
  registered!: number;

  @ApiProperty({ example: 60 })
  completedFunnel!: number;

  @ApiProperty({ example: 30 })
  decidedYes!: number;

  @ApiProperty({ example: 10 })
  decidedNo!: number;

  @ApiProperty({ example: 5 })
  becameDistributor!: number;
}

export class AnalyticsGeographyResponse {
  @ApiProperty({ example: 'IN' })
  country!: string;

  @ApiProperty({ example: 73 })
  count!: number;
}

export class AnalyticsBestDayResponse {
  @ApiProperty({ example: 'Monday' })
  dayOfWeek!: string;

  @ApiProperty({ example: 4.2 })
  avgLeads!: number;
}

export class AnalyticsOverviewResponse {
  @ApiProperty({ type: AnalyticsPipelineResponse })
  pipeline!: AnalyticsPipelineResponse;

  @ApiProperty({ type: [AnalyticsCampaignResponse] })
  campaigns!: AnalyticsCampaignResponse[];

  @ApiProperty({ type: AnalyticsFunnelDropOffResponse })
  funnelDropOff!: AnalyticsFunnelDropOffResponse;

  @ApiProperty({ type: [AnalyticsGeographyResponse] })
  geography!: AnalyticsGeographyResponse[];

  @ApiProperty({ type: [AnalyticsBestDayResponse] })
  bestDays!: AnalyticsBestDayResponse[];

  @ApiProperty({ type: [DistributorTrendPointResponse] })
  trend!: DistributorTrendPointResponse[];
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
  @ApiProperty({ example: 'event_uuid' })
  uuid!: string;

  @ApiProperty({ example: 'NOTE', enum: ['NOTE', 'TASK', 'FOLLOWUP'] })
  type!: string;

  @ApiProperty({ example: '2026-04-11T00:00:00.000Z' })
  date!: Date;

  @ApiPropertyOptional({
    example: '14:30',
    description: 'HH:mm — present for timed notes and follow-ups',
  })
  time!: string | null;

  @ApiPropertyOptional({
    example: 'Remember to ask about X',
    description: 'Present for NOTE and FOLLOWUP types',
  })
  content!: string | null;

  @ApiPropertyOptional({
    example: 'Call John Doe',
    description: 'Present for TASK and FOLLOWUP types',
  })
  title!: string | null;

  @ApiPropertyOptional({
    example: 'TODO',
    enum: ['TODO', 'IN_PROGRESS', 'COMPLETE'],
    description: 'Present for TASK type',
  })
  status!: string | null;

  @ApiPropertyOptional({
    example: 'lead_uuid',
    description: 'Present for FOLLOWUP type',
  })
  leadUuid?: string;

  @ApiPropertyOptional({
    example: 'HOT',
    description: 'Present for FOLLOWUP type',
  })
  leadStatus?: string;
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
