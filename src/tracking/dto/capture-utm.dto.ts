import { IsOptional, IsString } from 'class-validator';

export class CaptureUtmDto {
  @IsOptional()
  @IsString()
  utmSource?: string;

  @IsOptional()
  @IsString()
  utmMedium?: string;

  @IsOptional()
  @IsString()
  utmCampaign?: string;

  @IsOptional()
  @IsString()
  utmContent?: string;

  @IsOptional()
  @IsString()
  utmTerm?: string;

  @IsOptional()
  @IsString()
  referrerUrl?: string;

  @IsOptional()
  @IsString()
  landingPage?: string;

  @IsOptional()
  @IsString()
  distributorCode?: string;

  @IsOptional()
  @IsString()
  deviceType?: string;

  @IsOptional()
  @IsString()
  browser?: string;
}
