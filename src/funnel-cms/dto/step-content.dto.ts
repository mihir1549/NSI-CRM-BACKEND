import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsUrl,
  Min,
  IsNumber,
} from 'class-validator';

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

export class UpdatePaymentGateDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  subtitle?: string;

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsBoolean()
  allowCoupons?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
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
