import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { DistributorSubscriptionStatus } from '@prisma/client';

export class SubscriptionQueryDto {
  @IsOptional()
  @IsEnum(DistributorSubscriptionStatus)
  status?: DistributorSubscriptionStatus;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;
}
