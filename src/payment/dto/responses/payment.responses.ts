import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaymentOrderResponse {
  @ApiPropertyOptional({ example: 'order_12345' })
  orderId?: string;

  @ApiPropertyOptional({ example: 4000 })
  amount?: number;

  @ApiPropertyOptional({ example: 'INR' })
  currency?: string;

  @ApiPropertyOptional({ example: 'rzp_test_123' })
  keyId?: string;

  @ApiPropertyOptional({ example: true })
  freeAccess?: boolean;
}

export class PaymentItem {
  @ApiProperty({ example: 'payment_uuid' })
  uuid!: string;

  @ApiProperty({ example: 'order_12345' })
  gatewayOrderId!: string;

  @ApiProperty({ example: 5000 })
  amount!: number;

  @ApiProperty({ example: 1000 })
  discountAmount!: number;

  @ApiProperty({ example: 4000 })
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

export class PaymentStatusResponse {
  @ApiProperty({ example: true })
  paymentCompleted!: boolean;

  @ApiPropertyOptional({ type: PaymentItem })
  payment!: PaymentItem | null;
}
