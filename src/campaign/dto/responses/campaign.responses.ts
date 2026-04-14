import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CampaignOwner {
  @ApiProperty({ example: 'uuid' })
  uuid!: string;

  @ApiProperty({ example: 'Owner Name' })
  fullName!: string;

  @ApiPropertyOptional({ example: 'NAG2026' })
  distributorCode!: string | null;
}

export class CampaignItemResponse {
  @ApiProperty({ example: 'uuid' })
  uuid!: string;

  @ApiProperty({ example: 'ADMIN' })
  ownerType!: string;

  @ApiProperty({ example: 'owner_uuid' })
  ownerUuid!: string;

  @ApiProperty({ example: 'Summer Campaign' })
  name!: string;

  @ApiProperty({ example: 'facebook' })
  utmSource!: string;

  @ApiProperty({ example: 'cpc' })
  utmMedium!: string;

  @ApiProperty({ example: 'summer_sale' })
  utmCampaign!: string;

  @ApiPropertyOptional({ example: 'link_a' })
  utmContent!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2026-04-11T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-04-11T00:00:00.000Z' })
  updatedAt!: Date;

  @ApiProperty({ type: CampaignOwner })
  owner!: CampaignOwner;

  @ApiProperty({ example: 'https://growithnsi.com?utm_source=facebook&utm_medium=cpc&utm_campaign=summer_sale' })
  generatedUrl!: string;
}

export class CampaignAnalytics {
  @ApiProperty({ example: 100 })
  clicks!: number;

  @ApiProperty({ example: 50 })
  signups!: number;

  @ApiProperty({ example: 25 })
  funnelCompletions!: number;

  @ApiProperty({ example: 10 })
  conversions!: number;
}

export class CampaignDetailResponse extends CampaignItemResponse {
  @ApiProperty({ type: CampaignAnalytics })
  analytics!: CampaignAnalytics;
}

export class CampaignUpdateResponse {
  @ApiProperty({ example: 'Summer Campaign' })
  name!: string;

  @ApiProperty({ example: 'facebook' })
  utmSource!: string;

  @ApiProperty({ example: 'cpc' })
  utmMedium!: string;

  @ApiProperty({ example: 'summer_sale' })
  utmCampaign!: string;

  @ApiPropertyOptional({ example: 'link_a' })
  utmContent!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;
}
