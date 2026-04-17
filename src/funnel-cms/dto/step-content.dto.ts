import { ApiPropertyOptional } from '@nestjs/swagger';
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
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateStepContentDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'https://video.url/file.mp4' })
  @ValidateIf((o) => o.videoUrl !== undefined && o.videoUrl !== null && o.videoUrl !== '')
  @IsUrl()
  videoUrl?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  videoDuration?: number;

  @IsOptional()
  @IsString()
  textContent?: string;

  @IsOptional()
  @IsBoolean()
  requireVideoCompletion?: boolean;

  @ApiPropertyOptional({ example: 'video_id_123' })
  @IsOptional()
  @IsString()
  bunnyVideoId?: string | null;
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

  // Price in rupees (e.g. 500 = ₹500)
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

  // Promotional label (e.g. "Limited Offer", "Early Bird")
  @IsOptional()
  @IsString()
  badge?: string;

  // Strikethrough price shown to user
  @IsOptional()
  @IsNumber()
  @Min(0)
  originalPrice?: number;
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
