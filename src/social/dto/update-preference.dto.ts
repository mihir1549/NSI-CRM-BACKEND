import {
  IsOptional,
  IsArray,
  IsString,
  IsBoolean,
} from 'class-validator';

export class UpdatePreferenceDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedLanguages?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedTopics?: string[];

  @IsOptional()
  @IsBoolean()
  autoPostEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  autoDmEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  autoWhatsApp?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  notifyOnSources?: string[];
}
