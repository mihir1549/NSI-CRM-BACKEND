import { IsOptional, IsString } from 'class-validator';
import { PaymentStatus, PaymentType } from '@prisma/client';

export class CreateOrderDto {
  @IsOptional()
  @IsString()
  couponCode?: string;
}

export class PaymentResponseDto {
  uuid: string;
  gatewayOrderId: string;
  amount: number;
  discountAmount: number;
  finalAmount: number;
  currency: string;
  status: PaymentStatus;
  paymentType: PaymentType;
  createdAt: Date;
}
