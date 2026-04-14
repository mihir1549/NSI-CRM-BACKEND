import {
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PlanTestimonialDto {
  @ApiProperty({ example: 'Nageshwar Shukla', description: 'Testimonial author name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'This plan transformed my business in 3 months!', description: 'Testimonial text' })
  @IsString()
  @IsNotEmpty()
  text!: string;

  @ApiProperty({ example: 'NS', description: 'Avatar initials (2-3 chars)' })
  @IsString()
  @IsNotEmpty()
  avatarInitials!: string;

  @ApiPropertyOptional({ example: 'Mumbai, India', description: 'Author location' })
  @IsOptional()
  @IsString()
  location?: string;
}

export class CreatePlanDto {
  @ApiProperty({ example: 'Business Pro', description: 'Plan name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 1999, description: 'Monthly amount in rupees', minimum: 1 })
  @IsNumber()
  @Min(1)
  amount!: number;

  @ApiPropertyOptional({ example: 'Unlock your full distribution potential', description: 'Short tagline' })
  @IsOptional()
  @IsString()
  tagline?: string;

  @ApiPropertyOptional({ example: ['Unlimited leads', 'Priority support', 'LMS access'], description: 'Plan features', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @ApiPropertyOptional({ example: ['ISO Certified', '10k+ Members'], description: 'Trust badges', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  trustBadges?: string[];

  @ApiPropertyOptional({ example: 'Start Now', description: 'CTA button text' })
  @IsOptional()
  @IsString()
  ctaText?: string;

  @ApiPropertyOptional({ example: 'MOST POPULAR', description: 'Highlight badge label' })
  @IsOptional()
  @IsString()
  highlightBadge?: string;

  @ApiPropertyOptional({ description: 'Plan testimonials', type: [PlanTestimonialDto] })
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
  @ApiPropertyOptional({ example: 'Business Pro', description: 'Plan name' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ example: 'Unlock your full distribution potential', description: 'Short tagline' })
  @IsOptional()
  @IsString()
  tagline?: string;

  @ApiPropertyOptional({ example: 'Start Now', description: 'CTA button text' })
  @IsOptional()
  @IsString()
  ctaText?: string;

  @ApiPropertyOptional({ example: 'MOST POPULAR', description: 'Highlight badge label' })
  @IsOptional()
  @IsString()
  highlightBadge?: string;

  @ApiPropertyOptional({ example: ['Unlimited leads', 'Priority support'], description: 'Plan features', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @ApiPropertyOptional({ example: ['ISO Certified'], description: 'Trust badges', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  trustBadges?: string[];

  @ApiPropertyOptional({ description: 'Plan testimonials', type: [PlanTestimonialDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanTestimonialDto)
  testimonials?: PlanTestimonialDto[];
}
