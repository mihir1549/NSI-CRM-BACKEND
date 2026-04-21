import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Shared ─────────────────────────────────────────────────────────────────

export class AdminMessageResponse {
  @ApiProperty({ example: 'Action successful' })
  message!: string;

  @ApiPropertyOptional({ example: 'Additional note' })
  note?: string;
}

// ─── Users ──────────────────────────────────────────────────────────────────

export class AdminUserFunnelProgress {
  @ApiProperty({ example: 3 })
  completedSteps!: number;

  @ApiProperty({ example: 5 })
  totalSteps!: number;
}

export class AdminUserReferredBy {
  @ApiProperty({ example: 'DISTRIBUTOR' })
  type!: string;

  @ApiPropertyOptional({ example: 'John Admin' })
  distributorName!: string | null;

  @ApiPropertyOptional({ example: 'NAG2026' })
  distributorCode!: string | null;
}

export class AdminUserItem {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  uuid!: string;

  @ApiProperty({ example: 'John Doe' })
  fullName!: string;

  @ApiProperty({ example: 'john@example.com' })
  email!: string;

  @ApiPropertyOptional({ example: 'https://avatar.url' })
  avatarUrl!: string | null;

  @ApiProperty({ example: 'CUSTOMER' })
  role!: string;

  @ApiProperty({ example: 'ACTIVE' })
  status!: string;

  @ApiPropertyOptional({ example: 'US' })
  country!: string | null;

  @ApiProperty({ example: '2026-04-11T00:00:00.000Z' })
  createdAt!: Date;

  @ApiPropertyOptional({ example: '2026-04-12T00:00:00.000Z' })
  suspendedAt!: Date | null;

  @ApiPropertyOptional({ example: '+1234567890' })
  phone!: string | null;

  @ApiProperty({ example: true })
  phoneVerified!: boolean;

  @ApiProperty({ example: true })
  paymentCompleted!: boolean;

  @ApiProperty({ type: AdminUserFunnelProgress })
  funnelProgress!: AdminUserFunnelProgress;

  @ApiPropertyOptional({ example: 'HOT' })
  leadStatus!: string | null;

  @ApiProperty({ type: AdminUserReferredBy })
  referredBy!: AdminUserReferredBy;
}

export class AdminUserListResponse {
  @ApiProperty({ type: [AdminUserItem] })
  items!: AdminUserItem[];

  @ApiProperty({ example: 45 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}

export class AdminUserPaymentItem {
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

  @ApiProperty({ example: '2026-04-11T00:00:00.000Z' })
  createdAt!: Date;
}

export class AdminUserFunnelStepItem {
  @ApiProperty({ example: 'step_123' })
  stepUuid!: string;

  @ApiProperty({ example: 'VIDEO' })
  stepType!: string;

  @ApiProperty({ example: 1 })
  stepOrder!: number;

  @ApiProperty({ example: true })
  isCompleted!: boolean;

  @ApiProperty({ example: 120 })
  watchedSeconds!: number;

  @ApiPropertyOptional({ example: '2026-04-11T00:00:00.000Z' })
  completedAt!: Date | null;
}

export class AdminUserLeadDetail {
  @ApiProperty({ example: 'lead_123' })
  uuid!: string;

  @ApiProperty({ example: 'HOT' })
  status!: string;

  @ApiProperty({ example: '2026-04-11T00:00:00.000Z' })
  createdAt!: Date;

  @ApiPropertyOptional({ example: '2026-04-11T00:00:00.000Z' })
  lastActivityAt!: Date | null;

  @ApiPropertyOptional({ example: 'Called user' })
  lastActivityNote!: string | null;
}

export class AdminUserLmsProgress {
  @ApiProperty({ example: 'course_123' })
  courseUuid!: string;

  @ApiProperty({ example: 'Course Title' })
  courseTitle!: string;

  @ApiProperty({ example: '2026-04-11T00:00:00.000Z' })
  enrolledAt!: Date;

  @ApiPropertyOptional({ example: '2026-04-12T00:00:00.000Z' })
  completedAt!: Date | null;

  @ApiProperty({ example: 50 })
  progress!: number;

  @ApiPropertyOptional({ example: 'https://cert.url' })
  certificateUrl!: string | null;
}

export class AdminUserDetailResponse extends AdminUserItem {
  @ApiProperty({ type: [AdminUserPaymentItem] })
  paymentHistory!: AdminUserPaymentItem[];

  @ApiProperty({ type: [AdminUserFunnelStepItem] })
  funnelStepProgress!: AdminUserFunnelStepItem[];

  @ApiPropertyOptional({ type: AdminUserLeadDetail })
  leadDetail!: AdminUserLeadDetail | null;

  @ApiProperty({ type: [AdminUserLmsProgress] })
  lmsProgress!: AdminUserLmsProgress[];

  @ApiProperty({ example: 1 })
  activeSessions!: number;
}

// ─── Distributors ───────────────────────────────────────────────────────────

export class AdminDistributorItem {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  uuid!: string;

  @ApiProperty({ example: 'John Distributor' })
  fullName!: string;

  @ApiProperty({ example: 'john@example.com' })
  email!: string;

  @ApiPropertyOptional({ example: 'US' })
  country!: string | null;

  @ApiPropertyOptional({ example: 'NAG2026' })
  distributorCode!: string | null;

  @ApiPropertyOptional({ example: 'https://growithnsi.com/join/NAG2026' })
  joinLink!: string | null;

  @ApiProperty({ example: true })
  joinLinkActive!: boolean;

  @ApiProperty({ example: '2026-04-11T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: 45 })
  totalLeads!: number;

  @ApiProperty({ example: 10 })
  hotLeads!: number;

  @ApiProperty({ example: 5 })
  convertedLeads!: number;

  @ApiProperty({ example: '11.1%' })
  conversionRate!: string;

  @ApiProperty({ example: true })
  activeThisMonth!: boolean;
}

export class AdminDistributorListResponse {
  @ApiProperty({ type: [AdminDistributorItem] })
  items!: AdminDistributorItem[];

  @ApiProperty({ example: 45 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}

export class AdminDistributorRecentLead {
  @ApiProperty({ example: 'lead_123' })
  uuid!: string;

  @ApiProperty({ example: 'Jane Doe' })
  userFullName!: string;

  @ApiProperty({ example: 'jane@example.com' })
  userEmail!: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  phone!: string | null;

  @ApiProperty({ example: 'HOT' })
  status!: string;

  @ApiPropertyOptional({ example: 'US' })
  country!: string | null;

  @ApiProperty({ example: '2026-04-11T00:00:00.000Z' })
  createdAt!: Date;

  @ApiPropertyOptional({ example: '2026-04-12T00:00:00.000Z' })
  followupAt!: Date | null;
}

export class AdminDistributorFunnelPath {
  @ApiProperty({ example: 'HOT' })
  stage!: string;

  @ApiProperty({ example: 10 })
  count!: number;
}

export class AdminDistributorLeadsByCountry {
  @ApiProperty({ example: 'US' })
  country!: string;

  @ApiProperty({ example: 10 })
  count!: number;
}

export class AdminDistributorLeadsOverTime {
  @ApiProperty({ example: '2026-04' })
  period!: string;

  @ApiProperty({ example: 10 })
  count!: number;
}

export class AdminDistributorPerformance {
  @ApiProperty({ example: 45 })
  totalReferrals!: number;

  @ApiProperty({ example: 5 })
  successfulConversions!: number;

  @ApiProperty({ example: '11.1%' })
  conversionRate!: string;

  @ApiProperty({ type: [AdminDistributorFunnelPath] })
  funnelPath!: AdminDistributorFunnelPath[];

  @ApiProperty({ type: [AdminDistributorLeadsByCountry] })
  leadsByCountry!: AdminDistributorLeadsByCountry[];

  @ApiProperty({ type: [AdminDistributorLeadsOverTime] })
  leadsOverTime!: AdminDistributorLeadsOverTime[];
}

export class AdminDistributorDetailResponse extends AdminDistributorItem {
  @ApiProperty({ type: [AdminDistributorRecentLead] })
  recentLeads!: AdminDistributorRecentLead[];

  @ApiProperty({ type: AdminDistributorPerformance })
  performanceAnalytics!: AdminDistributorPerformance;
}

// ─── Analytics ──────────────────────────────────────────────────────────────

export class AdminAnalyticsOverview {
  @ApiProperty({ example: 100 }) totalUsers!: number;
  @ApiProperty({ example: 10 }) totalUsersGrowth!: number;
  @ApiProperty({ example: 80 }) phoneVerified!: number;
  @ApiProperty({ example: 50 }) paymentsCompleted!: number;
  @ApiProperty({ example: 30 }) hotLeads!: number;
  @ApiProperty({ example: 5 }) hotLeadsGrowth!: number;
  @ApiProperty({ example: 20 }) customers!: number;
  @ApiProperty({ example: 2 }) customersGrowth!: number;
  @ApiProperty({ example: 10 }) distributors!: number;
  @ApiProperty({ example: 1 }) distributorsGrowth!: number;
}

export class AdminAnalyticsDecisionSplit {
  @ApiProperty({ example: 30 }) yes!: number;
  @ApiProperty({ example: 20 }) no!: number;
  @ApiProperty({ example: 71.4 }) yesPercent!: number;
}

export class AdminAnalyticsFunnelStage {
  @ApiProperty({ example: 'Registered' }) stage!: string;
  @ApiProperty({ example: 100 }) count!: number;
}

export class AdminDashboardGrowthResponse {
  @ApiProperty({ example: 16.7 }) users!: number;
  @ApiProperty({ example: 24.0 }) leads!: number;
  @ApiProperty({ example: -12.5 }) customers!: number;
  @ApiProperty({ example: 8.3 }) revenue!: number;
  @ApiProperty({ example: 50.0 }) distributors!: number;
}

export class AdminDashboardPeriodResponse {
  @ApiProperty({ example: '2026-04-01T00:00:00.000Z' }) from!: string;
  @ApiProperty({ example: '2026-04-13T23:59:59.999Z' }) to!: string;
  @ApiProperty({ example: 42 }) users!: number;
  @ApiProperty({ example: 31 }) leads!: number;
  @ApiProperty({ example: 8 }) customers!: number;
  @ApiProperty({ example: 72000 }) revenue!: number;
  @ApiProperty({ example: 3 }) distributors!: number;
  @ApiProperty({ type: AdminDashboardGrowthResponse })
  growth!: AdminDashboardGrowthResponse;
}

export class AdminDashboardDevicesResponse {
  @ApiProperty({ example: 65 }) mobile!: number;
  @ApiProperty({ example: 30 }) desktop!: number;
  @ApiProperty({ example: 5 }) tablet!: number;
}

export class AdminDashboardBrowserItem {
  @ApiProperty({ example: 'Chrome' }) browser!: string;
  @ApiProperty({ example: 72.3 }) percentage!: number;
}

export class AdminDashboardFunnelSummaryResponse {
  @ApiProperty({ example: 312 }) totalFunnelStarts!: number;
  @ApiProperty({ example: 89 }) completedPayment!: number;
  @ApiProperty({ example: 34 }) decidedYes!: number;
  @ApiProperty({ example: 55 }) decidedNo!: number;
  @ApiProperty({ example: 10.9 }) overallConversionRate!: number;
}

export class AdminAnalyticsDashboardResponse {
  // Top-level lifetime totals (always all-time, no date filter)
  @ApiProperty({ example: 247 }) totalUsers!: number;
  @ApiProperty({ example: 189 }) totalLeads!: number;
  @ApiProperty({ example: 34 }) totalCustomers!: number;
  @ApiProperty({ example: 485000 }) totalRevenue!: number;
  @ApiProperty({ example: 12 }) totalDistributors!: number;

  // Period comparison — null when no from/to params, populated otherwise
  @ApiPropertyOptional({ type: AdminDashboardPeriodResponse, nullable: true })
  period!: AdminDashboardPeriodResponse | null;

  // Existing fields (preserved for backward compatibility)
  @ApiProperty({ type: AdminAnalyticsOverview })
  overview!: AdminAnalyticsOverview;

  @ApiProperty({ type: AdminAnalyticsDecisionSplit })
  decisionSplit!: AdminAnalyticsDecisionSplit;

  @ApiProperty({ type: [AdminAnalyticsFunnelStage] })
  funnelStages!: AdminAnalyticsFunnelStage[];

  @ApiProperty({ type: AdminDashboardDevicesResponse })
  devices!: AdminDashboardDevicesResponse;

  @ApiProperty({ type: [AdminDashboardBrowserItem] })
  topBrowsers!: AdminDashboardBrowserItem[];

  @ApiProperty({ type: AdminDashboardFunnelSummaryResponse })
  funnelSummary!: AdminDashboardFunnelSummaryResponse;
}

// For Analytics endpoints that are complex, define basic structural properties:
export class AdminAnalyticsFunnelStageDetailed extends AdminAnalyticsFunnelStage {
  @ApiProperty({ example: 20 }) dropoffFromPrevious!: number;
  @ApiProperty({ example: '20.0%' }) dropoffPercent!: string;
  @ApiProperty({ example: '50.0%' }) conversionFromStart!: string;
}

export class AdminAnalyticsFunnelPeriod {
  @ApiProperty({ example: '2026-04-01T00:00:00.000Z', nullable: true })
  from!: string | null;
  @ApiProperty({ example: '2026-04-21T23:59:59.999Z', nullable: true })
  to!: string | null;
}

export class AdminAnalyticsFunnelResponse {
  @ApiProperty({ type: AdminAnalyticsFunnelPeriod })
  period!: AdminAnalyticsFunnelPeriod;
  @ApiProperty({ example: 'month', nullable: true }) grouping!: string | null;
  @ApiProperty({ type: [AdminAnalyticsFunnelStageDetailed] })
  stages!: AdminAnalyticsFunnelStageDetailed[];
}

export class AnalyticsRevenueByType {
  @ApiProperty({ example: 5000 }) commitmentFee!: number;
  @ApiProperty({ example: 2000 }) lmsCourse!: number;
  @ApiProperty({ example: 1000 }) distributorSubscription!: number;
}

export class AnalyticsRevenueByCountry {
  @ApiProperty({ example: 'US' }) country!: string;
  @ApiProperty({ example: 5000 }) revenue!: number;
}

export class AdminAnalyticsChartItem {
  @ApiProperty({ example: '2026-04' }) period!: string;
  @ApiProperty({ example: 5000 }) revenue!: number;
}

export class AdminAnalyticsRevenueResponse {
  @ApiProperty({ example: 8000 }) totalRevenue!: number;
  @ApiProperty({ example: 15 }) totalRevenueGrowth!: number;
  @ApiProperty({ type: AnalyticsRevenueByType })
  byType!: AnalyticsRevenueByType;
  @ApiProperty({ type: [AnalyticsRevenueByCountry] })
  byCountry!: AnalyticsRevenueByCountry[];
  @ApiProperty({ example: 'month' }) grouping!: string;
  @ApiProperty({ type: [AdminAnalyticsChartItem] })
  chart!: AdminAnalyticsChartItem[];
}

export class AdminAnalyticsLeadsByStatus {
  @ApiProperty({ example: 10 }) new!: number;
  @ApiProperty({ example: 10 }) warm!: number;
  @ApiProperty({ example: 10 }) hot!: number;
  @ApiProperty({ example: 10 }) contacted!: number;
  @ApiProperty({ example: 10 }) followup!: number;
  @ApiProperty({ example: 10 }) nurture!: number;
  @ApiProperty({ example: 10 }) lost!: number;
  @ApiProperty({ example: 10 }) converted!: number;
}

export class AdminAnalyticsLeadsBySource {
  @ApiProperty({ example: 50 }) direct!: number;
  @ApiProperty({ example: 50 }) viaDistributor!: number;
}

export class AdminAnalyticsLeadsChartItem {
  @ApiProperty({ example: '2026-04' }) period!: string;
  @ApiProperty({ example: 50 }) newLeads!: number;
  @ApiProperty({ example: 10 }) converted!: number;
}

export class AdminAnalyticsLeadsResponse {
  @ApiProperty({ example: 100 }) totalLeads!: number;
  @ApiProperty({ type: AdminAnalyticsLeadsByStatus })
  byStatus!: AdminAnalyticsLeadsByStatus;
  @ApiProperty({ type: AdminAnalyticsLeadsBySource })
  bySource!: AdminAnalyticsLeadsBySource;
  @ApiProperty({ example: 5 }) todayFollowups!: number;
  @ApiProperty({ example: 'month' }) grouping!: string;
  @ApiProperty({ type: [AdminAnalyticsLeadsChartItem] })
  chart!: AdminAnalyticsLeadsChartItem[];
}

export class UtmEntryDetailed {
  @ApiPropertyOptional({ example: 'facebook' }) source?: string;
  @ApiPropertyOptional({ example: 'cpc' }) medium?: string;
  @ApiPropertyOptional({ example: 'summer_sale' }) campaign?: string;
  @ApiProperty({ example: 15 }) leads!: number;
}

export class AdminAnalyticsUtmResponse {
  @ApiProperty({ type: [UtmEntryDetailed] }) bySource!: UtmEntryDetailed[];
  @ApiProperty({ type: [UtmEntryDetailed] }) byMedium!: UtmEntryDetailed[];
  @ApiProperty({ type: [UtmEntryDetailed] }) byCampaign!: UtmEntryDetailed[];
  @ApiProperty({ example: 45 }) total!: number;
  @ApiProperty({ example: '2026-03-12T00:00:00.000Z' }) from!: string;
  @ApiProperty({ example: '2026-04-11T23:59:59.999Z' }) to!: string;
}

export class AdminAnalyticsTopDistributor {
  @ApiProperty({ example: 'uuid' }) uuid!: string;
  @ApiProperty({ example: 'John Distributor' }) fullName!: string;
  @ApiPropertyOptional({ example: 'NAG2026' }) distributorCode!: string | null;
  @ApiProperty({ example: 45 }) totalLeads!: number;
  @ApiProperty({ example: 5 }) convertedLeads!: number;
  @ApiProperty({ example: '11.1%' }) conversionRate!: string;
}

export class AdminAnalyticsDistributorsLifetime {
  @ApiProperty({ example: 10 }) totalDistributors!: number;
  @ApiProperty({ example: 45 }) avgLeadsPerDistributor!: number;
  @ApiProperty({ example: 11.1 }) avgConversionRate!: number;
  @ApiProperty({ type: [AdminAnalyticsTopDistributor] })
  topDistributors!: AdminAnalyticsTopDistributor[];
}

export class AdminAnalyticsDistributorsThisMonth {
  @ApiProperty({ example: 5 }) activeDistributors!: number;
}

export class AdminAnalyticsDistributorsPeriod {
  @ApiProperty({ example: '2026-04-01T00:00:00.000Z', nullable: true })
  from!: string | null;
  @ApiProperty({ example: '2026-04-21T23:59:59.999Z', nullable: true })
  to!: string | null;
  @ApiProperty({ type: [AdminDistributorFunnelPath] })
  funnelPath!: AdminDistributorFunnelPath[];
}

export class AdminAnalyticsDistributorsResponse {
  @ApiProperty({ type: AdminAnalyticsDistributorsLifetime })
  lifetime!: AdminAnalyticsDistributorsLifetime;
  @ApiProperty({ type: AdminAnalyticsDistributorsThisMonth })
  thisMonth!: AdminAnalyticsDistributorsThisMonth;
  @ApiProperty({ type: AdminAnalyticsDistributorsPeriod })
  period!: AdminAnalyticsDistributorsPeriod;
}
