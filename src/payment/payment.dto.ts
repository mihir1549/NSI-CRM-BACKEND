import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PaymentStatus, PaymentType } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiProperty({ example: 'WELCOME10', required: false })
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiProperty({ example: true, description: 'User must accept terms' })
  @IsBoolean()
  @IsNotEmpty()
  termsAccepted: boolean;

  @ApiProperty({ example: '2026-04-21-v1', description: 'Terms version version' })
  @IsString()
  @IsNotEmpty()
  termsVersion: string;
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
