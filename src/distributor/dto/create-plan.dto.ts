import {
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
  IsOptional,
  IsArray,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PlanTestimonialDto {
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

export class CreatePlanDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @Min(1)
  amount!: number; // in rupees

  // Rich content — all optional
  @IsOptional()
  @IsString()
  tagline?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  trustBadges?: string[];

  @IsOptional()
  @IsString()
  ctaText?: string;

  @IsOptional()
  @IsString()
  highlightBadge?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanTestimonialDto)
  testimonials?: PlanTestimonialDto[];
}

/**
 * UpdatePlanDto — used by PATCH /admin/distributor-plans/:uuid
 * Only content fields are editable. amount, razorpayPlanId, and interval
 * are intentionally excluded because they are Razorpay-managed.
 */
export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  tagline?: string;

  @IsOptional()
  @IsString()
  ctaText?: string;

  @IsOptional()
  @IsString()
  highlightBadge?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  trustBadges?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanTestimonialDto)
  testimonials?: PlanTestimonialDto[];
}
