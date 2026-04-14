import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCampaignDto {
  @ApiProperty({ example: 'Diwali 2026 Push', description: 'Campaign display name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'facebook', description: 'UTM source (e.g. facebook, google)' })
  @IsString()
  @IsNotEmpty()
  utmSource!: string;

  @ApiProperty({ example: 'paid-social', description: 'UTM medium (e.g. paid-social, email)' })
  @IsString()
  @IsNotEmpty()
  utmMedium!: string;

  @ApiProperty({ example: 'diwali-2026', description: 'UTM campaign slug (no spaces)' })
  @IsString()
  @IsNotEmpty()
  utmCampaign!: string;

  @ApiPropertyOptional({ example: 'banner-v1', description: 'UTM content variant identifier' })
  @IsOptional()
  @IsString()
  utmContent?: string;
}
