import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Structure ──────────────────────────────────────────────────────────────

export class FunnelStepConfig {
  @ApiProperty({ example: 'step_uuid_123' })
  uuid!: string;

  @ApiProperty({ example: 'VIDEO_TEXT' })
  type!: string;

  @ApiProperty({ example: 1 })
  order!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: 'Welcome Video' })
  title!: string;
}

export class FunnelSectionConfig {
  @ApiProperty({ example: 'section_uuid_123' })
  uuid!: string;

  @ApiProperty({ example: 'Module 1' })
  name!: string;

  @ApiPropertyOptional({ example: 'Introduction to our funnel' })
  description!: string | null;

  @ApiProperty({ example: 1 })
  order!: number;

  @ApiProperty({ type: [FunnelStepConfig] })
  steps!: FunnelStepConfig[];
}

export class FunnelStructureResponse {
  @ApiProperty({ type: [FunnelSectionConfig] })
  sections!: FunnelSectionConfig[];
}

// ─── Progress ───────────────────────────────────────────────────────────────

export class FunnelProgressResponse {
  @ApiPropertyOptional({ example: 'section_uuid_123' })
  currentSectionUuid!: string | null;

  @ApiPropertyOptional({ example: 'step_uuid_123' })
  currentStepUuid!: string | null;

  @ApiProperty({ example: 'IN_PROGRESS' })
  status!: string;

  @ApiProperty({ example: true })
  phoneVerified!: boolean;

  @ApiProperty({ example: false })
  paymentCompleted!: boolean;

  @ApiPropertyOptional({ example: 'YES' })
  decisionAnswer!: string | null;

  @ApiProperty({ type: [String], example: ['step_uuid_123', 'step_uuid_456'] })
  completedStepUuids!: string[];
}

// ─── Step Content Types ─────────────────────────────────────────────────────

export class FunnelStepContentVideo {
  @ApiProperty({ example: 'content_uuid_123' })
  uuid!: string;

  @ApiProperty({ example: 'step_uuid_123' })
  stepUuid!: string;

  @ApiProperty({ example: 'Welcome to NSI' })
  title!: string;

  @ApiPropertyOptional({ example: '<p>Some description</p>' })
  bodyHtml!: string | null;

  @ApiPropertyOptional({ example: 'https://video.url/file.mp4' })
  videoUrl!: string | null;

  @ApiPropertyOptional({ example: 'https://video.url/thumbnail.jpg' })
  videoThumbnailUrl!: string | null;

  @ApiProperty({ example: 120 })
  videoDuration!: number;

  @ApiProperty({ example: true })
  requireVideoCompletion!: boolean;

  @ApiPropertyOptional({ example: 1713264421, description: 'Signed URL expiry' })
  videoExpiry!: number | null;

  @ApiProperty({ example: 'bunny', enum: ['bunny', 'direct'] })
  videoProvider!: string;
}

export class FunnelStepPhoneGate {
  @ApiProperty({ example: 'pg_uuid_123' })
  uuid!: string;

  @ApiProperty({ example: 'Verify your phone number' })
  title!: string;

  @ApiPropertyOptional({ example: 'We need this to contact you.' })
  subtitle!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;
}

export class FunnelStepPaymentTestimonial {
  @ApiProperty({ example: 'Jane Doe' })
  name!: string;

  @ApiProperty({ example: 'This was life changing!' })
  text!: string;

  @ApiProperty({ example: 'JD' })
  avatarInitials!: string;

  @ApiPropertyOptional({ example: 'New York, US' })
  location?: string;
}

export class FunnelStepPaymentGateContent {
  @ApiProperty({ example: 'Commitment Fee' })
  heading!: string;

  @ApiProperty({ example: 'Join the next stage of our program.' })
  subheading!: string;

  @ApiProperty({ example: 499 })
  amount!: number;

  @ApiProperty({ example: 'INR' })
  currency!: string;

  @ApiProperty({ example: 'Proceed to Payment' })
  ctaText!: string;

  @ApiProperty({
    type: [String],
    example: ['1-on-1 Mentorship', 'Community Access'],
  })
  features!: string[];

  @ApiProperty({
    type: [String],
    example: ['Secure Payment', 'Money Back Guarantee'],
  })
  trustBadges!: string[];

  @ApiProperty({ type: [FunnelStepPaymentTestimonial] })
  testimonials!: FunnelStepPaymentTestimonial[];

  @ApiProperty({ example: true })
  allowCoupons!: boolean;

  @ApiProperty({ example: true })
  enabled!: boolean;

  @ApiPropertyOptional({ example: 'Limited Offer', description: 'Promotional label shown on the payment gate' })
  badge!: string | null;

  @ApiPropertyOptional({ example: 999, description: 'Strikethrough price shown to user' })
  originalPrice!: number | null;

  @ApiPropertyOptional({ example: 50, description: 'Computed discount percentage (null when no originalPrice or originalPrice <= amount)' })
  discountPercent!: number | null;
}

export class FunnelStepDecisionStep {
  @ApiProperty({ example: 'dec_uuid_123' })
  uuid!: string;

  @ApiProperty({ example: 'Are you ready?' })
  title!: string;

  @ApiPropertyOptional({ example: 'Make your final choice.' })
  subtitle!: string | null;

  @ApiPropertyOptional({ example: 'https://video.url/decision.mp4' })
  videoUrl!: string | null;

  @ApiPropertyOptional({ example: 'https://video.url/thumbnail.jpg' })
  videoThumbnailUrl!: string | null;
}

export class FunnelStepResponse {
  @ApiProperty({ example: 'VIDEO_TEXT' })
  type!: string;

  @ApiPropertyOptional({ type: FunnelStepContentVideo })
  content?: FunnelStepContentVideo | null;

  @ApiPropertyOptional({ type: FunnelStepPhoneGate })
  phoneGate?: FunnelStepPhoneGate | null;

  @ApiPropertyOptional({ type: FunnelStepPaymentGateContent })
  paymentGate?: FunnelStepPaymentGateContent | null;

  @ApiPropertyOptional({ type: FunnelStepDecisionStep })
  decisionStep?: FunnelStepDecisionStep | null;
}

export class FunnelActionResponse {
  @ApiProperty({ example: true })
  ok!: boolean;

  @ApiPropertyOptional({ example: 'Step already completed' })
  message?: string;
}
