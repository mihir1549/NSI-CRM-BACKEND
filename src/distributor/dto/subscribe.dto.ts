import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubscribeDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Distributor plan UUID to subscribe to',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  planUuid: string;

  @ApiProperty({ example: true, description: 'User must accept terms' })
  @IsBoolean()
  @IsNotEmpty()
  termsAccepted: boolean;

  @ApiProperty({
    example: '2026-04-21-v1',
    description: 'Terms version displayed to user',
  })
  @IsString()
  @IsNotEmpty()
  termsVersion: string;

  @ApiProperty({ example: 'WELCOME10', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9]+$/, { message: 'Coupon code must be alphanumeric' })
  couponCode?: string;
}
