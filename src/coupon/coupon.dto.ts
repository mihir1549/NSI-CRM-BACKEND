import {
  IsString,
  IsEnum,
  IsInt,
  IsOptional,
  IsBoolean,
  IsDateString,
  Min,
  Max,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';
import { CouponType, CouponScope, PaymentType } from '@prisma/client';

export class CreateCouponDto {
  @IsString()
  @MinLength(4)
  @MaxLength(20)
  @Matches(/^[A-Z0-9]+$/, { message: 'Coupon code must be uppercase alphanumeric' })
  code: string;

  @IsEnum(CouponType)
  type: CouponType;

  @IsInt()
  @Min(0)
  value: number;

  @IsEnum(CouponScope)
  applicableTo: CouponScope;

  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  perUserLimit: number = 1;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class UpdateCouponDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;
}

export class ValidateCouponDto {
  @IsString()
  @Matches(/^[A-Za-z0-9]+$/, { message: 'Coupon code must be alphanumeric' })
  code: string;

  @IsEnum(PaymentType)
  paymentType: PaymentType;
}

export class PercentDto {
  @IsInt()
  @Min(1)
  @Max(100)
  value: number;
}
