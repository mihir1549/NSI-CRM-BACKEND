import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CouponMessageResponse {
  @ApiProperty({ example: 'Coupon permanently deleted.' })
  message!: string;
}

export class CouponItem {
  @ApiProperty({ example: 'coupon_uuid' })
  uuid!: string;

  @ApiProperty({ example: 'SUMMER20' })
  code!: string;

  @ApiProperty({ example: 'PERCENT' })
  type!: string;

  @ApiProperty({ example: 20 })
  value!: number;

  @ApiProperty({ example: 'ALL' })
  applicableTo!: string;

  @ApiPropertyOptional({ example: 100 })
  usageLimit!: number | null;

  @ApiProperty({ example: 1 })
  perUserLimit!: number;

  @ApiProperty({ example: 5 })
  usedCount!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  expiresAt!: Date | null;

  @ApiProperty({ example: '2026-04-11T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-04-11T00:00:00.000Z' })
  updatedAt!: Date;

  @ApiProperty({ example: 'ACTIVE' })
  status!: string;
}

export class CouponUserItem {
  @ApiProperty({ example: 'user_uuid' })
  uuid!: string;

  @ApiProperty({ example: 'John Doe' })
  fullName!: string;

  @ApiProperty({ example: 'john@example.com' })
  email!: string;
}

export class CouponUseItem {
  @ApiProperty({ example: 'use_uuid' })
  uuid!: string;

  @ApiProperty({ example: 'coupon_uuid' })
  couponUuid!: string;

  @ApiProperty({ example: 'user_uuid' })
  userUuid!: string;

  @ApiProperty({ example: '2026-04-11T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ type: CouponUserItem })
  user!: CouponUserItem;
}

export class CouponDetailResponse extends CouponItem {
  @ApiProperty({ type: [CouponUseItem] })
  uses!: CouponUseItem[];
}

export class CouponUpdateResponse {
  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  expiresAt!: string | null;

  @ApiPropertyOptional({ example: 100 })
  usageLimit!: number | null;
}

export class CouponValidationResponse {
  @ApiProperty({ example: true })
  valid!: boolean;

  @ApiProperty({ example: 'SUMMER20' })
  couponCode!: string;

  @ApiProperty({ example: 'PERCENT' })
  couponType!: string;

  @ApiProperty({ example: 5000 })
  originalAmount!: number;

  @ApiProperty({ example: 1000 })
  discountAmount!: number;

  @ApiProperty({ example: 4000 })
  finalAmount!: number;

  @ApiProperty({ example: 'Coupon is valid' })
  message!: string;
}
