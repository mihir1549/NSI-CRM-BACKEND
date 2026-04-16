import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCampaignDto {
  @ApiPropertyOptional({
    example: 'Diwali 2026 Push',
    description: 'Campaign display name',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'facebook', description: 'UTM source' })
  @IsOptional()
  @IsString()
  utmSource?: string;

  @ApiPropertyOptional({ example: 'paid-social', description: 'UTM medium' })
  @IsOptional()
  @IsString()
  utmMedium?: string;

  @ApiPropertyOptional({
    example: 'diwali-2026',
    description: 'UTM campaign slug',
  })
  @IsOptional()
  @IsString()
  utmCampaign?: string;

  @ApiPropertyOptional({
    example: 'banner-v1',
    description: 'UTM content variant',
  })
  @IsOptional()
  @IsString()
  utmContent?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether the campaign is active',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
