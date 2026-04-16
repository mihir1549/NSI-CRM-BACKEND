import {
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBroadcastDto {
  @ApiProperty({
    example: 'BROADCAST',
    enum: ['ANNOUNCEMENT', 'BROADCAST'],
    description:
      'Message type. ANNOUNCEMENT is sticky/non-dismissable; BROADCAST is dismissable.',
  })
  @IsIn(['ANNOUNCEMENT', 'BROADCAST'])
  type!: string;

  @ApiProperty({
    example: 'Platform Maintenance Tonight',
    maxLength: 100,
    description:
      'Short title shown in banner and bell dropdown (max 100 chars)',
  })
  @IsString()
  @MaxLength(100)
  title!: string;

  @ApiProperty({
    example:
      'Scheduled maintenance from 2:00–4:00 AM UTC. Platform will be read-only.',
    maxLength: 160,
    description:
      'Short message shown in banner and bell dropdown (max 160 chars)',
  })
  @IsString()
  @MaxLength(160)
  shortMessage!: string;

  @ApiPropertyOptional({
    example: 'Full details about the maintenance window...',
    description: 'Optional long-form content shown on dedicated detail page',
  })
  @IsOptional()
  @IsString()
  fullContent?: string;

  @ApiPropertyOptional({
    example: 'https://status.example.com',
    description: 'Optional URL — "Read more" redirects here if set',
  })
  @IsOptional()
  @IsString()
  link?: string;

  @ApiPropertyOptional({
    example: 'USER',
    enum: ['ALL', 'USER', 'CUSTOMER', 'DISTRIBUTOR'],
    description:
      'Target role filter. null/ALL = everyone. Ignored for ANNOUNCEMENT type.',
  })
  @IsOptional()
  @IsIn(['ALL', 'USER', 'CUSTOMER', 'DISTRIBUTOR'])
  targetRole?: string;

  @ApiPropertyOptional({
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    type: [String],
    description:
      'Specific user UUIDs to target. Empty = all matching the role.',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  targetUuids?: string[];

  @ApiPropertyOptional({
    example: '2026-12-31T23:59:59.000Z',
    description:
      'Optional expiry date-time (ISO 8601). Message auto-hides after this.',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
