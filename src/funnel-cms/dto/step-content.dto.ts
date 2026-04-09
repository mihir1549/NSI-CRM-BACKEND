import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsUrl,
  Min,
  IsNumber,
  IsArray,
  IsNotEmpty,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateStepContentDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl()
  videoUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  videoDuration?: number;

  @IsOptional()
  @IsUrl()
  thumbnailUrl?: string;

  @IsOptional()
  @IsString()
  textContent?: string;

  @IsOptional()
  @IsBoolean()
  requireVideoCompletion?: boolean;
}

export class UpdatePhoneGateDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  subtitle?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ─── Payment Gate ────────────────────────────────────────────

export class TestimonialDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  text!: string;

  @IsString()
  @IsNotEmpty()
  avatarInitials!: string;

  @IsOptional()
  @IsString()
  location?: string;
}

export class UpdatePaymentGateDto {
  // Main heading (maps to PaymentGateConfig.title)
  @IsString()
  @IsNotEmpty()
  heading!: string;

  // Supporting subheading
  @IsString()
  subheading!: string;

  // Price in paise (e.g. 50000 = ₹500)
  @IsNumber()
  amount!: number;

  @IsString()
  @IsNotEmpty()
  currency!: string;

  // CTA button label
  @IsString()
  @IsNotEmpty()
  ctaText!: string;

  // Feature bullets
  @IsArray()
  @IsString({ each: true })
  features!: string[];

  // Trust badges
  @IsArray()
  @IsString({ each: true })
  trustBadges!: string[];

  // Testimonials carousel
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestimonialDto)
  testimonials!: TestimonialDto[];

  // Gate settings
  @IsBoolean()
  allowCoupons!: boolean;

  @IsBoolean()
  enabled!: boolean;
}

export class UpdateDecisionStepDto {
  @IsOptional()
  @IsString()
  question?: string;

  @IsOptional()
  @IsString()
  yesLabel?: string;

  @IsOptional()
  @IsString()
  noLabel?: string;

  @IsOptional()
  @IsString()
  yesSubtext?: string;

  @IsOptional()
  @IsString()
  noSubtext?: string;
}
