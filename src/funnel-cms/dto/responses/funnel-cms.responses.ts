import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Shared ──────────────────────────────────────────────────────────────

export class CmsMessageResponse {
  @ApiProperty({ example: true })
  ok!: boolean;
}

// ─── Sections ────────────────────────────────────────────────────────────

export class CmsSectionItem {
  @ApiProperty({ example: 'section_123' })
  uuid!: string;

  @ApiProperty({ example: 'Introduction' })
  name!: string;

  @ApiPropertyOptional({ example: 'Intro section' })
  description!: string | null;

  @ApiProperty({ example: 1 })
  order!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2026-04-11T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-04-11T00:00:00.000Z' })
  updatedAt!: Date;
}

export class CmsSectionUpdateResponse {
  @ApiProperty({ example: 'Introduction' })
  name!: string;

  @ApiPropertyOptional({ example: 'Intro section' })
  description!: string | null;

  @ApiProperty({ example: 1 })
  order!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;
}

// ─── Steps ───────────────────────────────────────────────────────────────

export class CmsStepContent {
  @ApiProperty({ example: 'Content Title' })
  title!: string;

  @ApiPropertyOptional({ example: 'Content Description' })
  description!: string | null;

  @ApiPropertyOptional({ example: 'https://video.url' })
  videoUrl!: string | null;

  @ApiPropertyOptional({ example: 120 })
  videoDuration!: number | null;

  @ApiPropertyOptional({ example: '<p>HTML Content</p>' })
  textContent!: string | null;

  @ApiProperty({ example: true })
  requireVideoCompletion!: boolean;
}

export class CmsPhoneGate {
  @ApiProperty({ example: 'Verify your phone' })
  title!: string;

  @ApiPropertyOptional({ example: 'Subtitle' })
  subtitle!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;
}

export class CmsPaymentGate {
  @ApiProperty({ example: 'Payment' })
  title!: string;

  @ApiPropertyOptional({ example: '{}' })
  subtitle!: string | null;

  @ApiProperty({ example: 499 })
  amount!: number;

  @ApiProperty({ example: 'INR' })
  currency!: string;

  @ApiProperty({ example: true })
  allowCoupons!: boolean;

  @ApiProperty({ example: true })
  isActive!: boolean;
}

export class CmsDecisionStep {
  @ApiProperty({ example: 'Are you ready?' })
  question!: string;

  @ApiProperty({ example: 'Yes' })
  yesLabel!: string;

  @ApiProperty({ example: 'No' })
  noLabel!: string;

  @ApiPropertyOptional({ example: 'Proceed to payment' })
  yesSubtext!: string | null;

  @ApiPropertyOptional({ example: 'Maybe later' })
  noSubtext!: string | null;
}

export class CmsStepItem {
  @ApiProperty({ example: 'step_123' })
  uuid!: string;

  @ApiProperty({ example: 'section_123' })
  sectionUuid!: string;

  @ApiProperty({ example: 'VIDEO_TEXT' })
  type!: string;

  @ApiProperty({ example: 1 })
  order!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiPropertyOptional({ type: CmsStepContent })
  content?: CmsStepContent | null;

  @ApiPropertyOptional({ type: CmsPhoneGate })
  phoneGate?: CmsPhoneGate | null;

  @ApiPropertyOptional({ type: CmsPaymentGate })
  paymentGate?: CmsPaymentGate | null;

  @ApiPropertyOptional({ type: CmsDecisionStep })
  decisionStep?: CmsDecisionStep | null;
}

export class CmsSectionWithStepsItem extends CmsSectionItem {
  @ApiProperty({ type: [CmsStepItem] })
  steps!: CmsStepItem[];
}

export class CmsStepUpdateResponse {
  @ApiProperty({ example: 1 })
  order!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;
}

// ─── Analytics ───────────────────────────────────────────────────────────

export class CmsAnalyticsFunnelStep {
  @ApiProperty({ example: 'step_123' })
  stepUuid!: string;

  @ApiProperty({ example: 'Welcome Video' })
  stepTitle!: string;

  @ApiProperty({ example: 'VIDEO_TEXT' })
  stepType!: string;

  @ApiProperty({ example: 'Introduction' })
  sectionName!: string;

  @ApiProperty({ example: 1 })
  order!: number;

  @ApiProperty({ example: 100 })
  totalReached!: number;

  @ApiProperty({ example: 80 })
  totalCompleted!: number;

  @ApiProperty({ example: 20 })
  dropOffCount!: number;

  @ApiProperty({ example: 20.5 })
  dropOffRate!: number;
}

export class CmsAnalyticsUtmSource {
  @ApiProperty({ example: 'facebook' }) utmSource!: string | null;
  @ApiProperty({ example: 50 }) count!: number;
}
export class CmsAnalyticsUtmMedium {
  @ApiProperty({ example: 'cpc' }) utmMedium!: string | null;
  @ApiProperty({ example: 50 }) count!: number;
}
export class CmsAnalyticsUtmCampaign {
  @ApiProperty({ example: 'summer' }) utmCampaign!: string | null;
  @ApiProperty({ example: 50 }) count!: number;
}
export class CmsAnalyticsUtmDistributor {
  @ApiProperty({ example: 'NAG2026' }) distributorCode!: string | null;
  @ApiProperty({ example: 'uuid' }) distributorUuid!: string | null;
  @ApiProperty({ example: 50 }) count!: number;
}

export class CmsAnalyticsUtmResponse {
  @ApiProperty({ type: [CmsAnalyticsUtmSource] })
  bySource!: CmsAnalyticsUtmSource[];
  @ApiProperty({ type: [CmsAnalyticsUtmMedium] })
  byMedium!: CmsAnalyticsUtmMedium[];
  @ApiProperty({ type: [CmsAnalyticsUtmCampaign] })
  byCampaign!: CmsAnalyticsUtmCampaign[];
  @ApiProperty({ type: [CmsAnalyticsUtmDistributor] })
  byDistributor!: CmsAnalyticsUtmDistributor[];
}

export class CmsAnalyticsDeviceItem {
  @ApiProperty({ example: 'mobile' }) deviceType!: string | null;
  @ApiProperty({ example: 100 }) count!: number;
}

export class CmsAnalyticsCountryItem {
  @ApiProperty({ example: 'US' }) country!: string | null;
  @ApiProperty({ example: 100 }) count!: number;
}

export class CmsAnalyticsDeviceResponse {
  @ApiProperty({ type: [CmsAnalyticsDeviceItem] })
  byDevice!: CmsAnalyticsDeviceItem[];
  @ApiProperty({ type: [CmsAnalyticsCountryItem] })
  byCountry!: CmsAnalyticsCountryItem[];
}

export class CmsAnalyticsConversionResponse {
  @ApiProperty({ example: 1000 }) totalRegistered!: number;
  @ApiProperty({ example: 800 }) totalPhoneVerified!: number;
  @ApiProperty({ example: 500 }) totalPaid!: number;
  @ApiProperty({ example: 400 }) totalReachedDecision!: number;
  @ApiProperty({ example: 300 }) totalYes!: number;
  @ApiProperty({ example: 100 }) totalNo!: number;
  @ApiProperty({ example: 80.0 }) phoneVerifyRate!: number;
  @ApiProperty({ example: 62.5 }) paymentRate!: number;
  @ApiProperty({ example: 80.0 }) decisionRate!: number;
  @ApiProperty({ example: 75.0 }) yesRate!: number;
}
