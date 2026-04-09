import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  utmSource!: string;

  @IsString()
  @IsNotEmpty()
  utmMedium!: string;

  @IsString()
  @IsNotEmpty()
  utmCampaign!: string; // slug, no spaces

  @IsOptional()
  @IsString()
  utmContent?: string;
}
