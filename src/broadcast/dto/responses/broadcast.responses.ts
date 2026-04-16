import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BroadcastAnnouncementItem {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  uuid!: string;

  @ApiProperty({ example: 'Platform Maintenance Tonight' })
  title!: string;

  @ApiProperty({ example: 'Scheduled maintenance from 2:00–4:00 AM UTC.' })
  shortMessage!: string;

  @ApiPropertyOptional({ example: 'Full details about the maintenance...' })
  fullContent!: string | null;

  @ApiPropertyOptional({ example: 'https://status.example.com' })
  link!: string | null;

  @ApiProperty({ example: '2026-04-16T12:00:00.000Z' })
  createdAt!: Date;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  expiresAt!: Date | null;
}

export class BroadcastItem {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  uuid!: string;

  @ApiProperty({ example: 'New Feature Available' })
  title!: string;

  @ApiProperty({
    example: 'Check out the new dashboard — your team will love it.',
  })
  shortMessage!: string;

  @ApiPropertyOptional({ example: 'Full details about the feature...' })
  fullContent!: string | null;

  @ApiPropertyOptional({ example: 'https://docs.example.com/new-feature' })
  link!: string | null;

  @ApiProperty({ example: 'SUPER_ADMIN', enum: ['SUPER_ADMIN', 'DISTRIBUTOR'] })
  createdByRole!: string;

  @ApiProperty({ example: '2026-04-16T12:00:00.000Z' })
  createdAt!: Date;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  expiresAt!: Date | null;
}

export class ActiveBroadcastsResponse {
  @ApiProperty({ type: [BroadcastAnnouncementItem] })
  announcements!: BroadcastAnnouncementItem[];

  @ApiProperty({ type: [BroadcastItem] })
  broadcasts!: BroadcastItem[];

  @ApiProperty({
    example: 3,
    description: 'Unread BROADCAST count (announcements excluded)',
  })
  unreadCount!: number;
}

export class BroadcastAdminItem {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  uuid!: string;

  @ApiProperty({ example: 'BROADCAST', enum: ['ANNOUNCEMENT', 'BROADCAST'] })
  type!: string;

  @ApiProperty({ example: 'New Feature Available' })
  title!: string;

  @ApiProperty({ example: 'Check out the new dashboard.' })
  shortMessage!: string;

  @ApiPropertyOptional({ example: 'Full content...' })
  fullContent!: string | null;

  @ApiPropertyOptional({ example: 'https://docs.example.com' })
  link!: string | null;

  @ApiPropertyOptional({
    example: 'USER',
    enum: ['USER', 'CUSTOMER', 'DISTRIBUTOR'],
  })
  targetRole!: string | null;

  @ApiProperty({ example: [] })
  targetUuids!: string[];

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  createdByUuid!: string;

  @ApiProperty({ example: 'SUPER_ADMIN', enum: ['SUPER_ADMIN', 'DISTRIBUTOR'] })
  createdByRole!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  expiresAt!: Date | null;

  @ApiProperty({ example: '2026-04-16T12:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-04-16T12:00:00.000Z' })
  updatedAt!: Date;

  @ApiProperty({
    example: 42,
    description: 'Number of users who have read/dismissed this message',
  })
  readCount!: number;
}

export class BroadcastListResponse {
  @ApiProperty({ type: [BroadcastAdminItem] })
  data!: BroadcastAdminItem[];

  @ApiProperty({ example: 100 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 5 })
  totalPages!: number;
}

export class BroadcastMessageResponse {
  @ApiProperty({ example: 'Dismissed' })
  message!: string;
}

export class BroadcastDetailResponse {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  uuid!: string;

  @ApiProperty({ example: 'BROADCAST', enum: ['ANNOUNCEMENT', 'BROADCAST'] })
  type!: string;

  @ApiProperty({ example: 'New Feature Available' })
  title!: string;

  @ApiProperty({ example: 'Check out the new dashboard.' })
  shortMessage!: string;

  @ApiPropertyOptional({ example: 'Full content...' })
  fullContent!: string | null;

  @ApiPropertyOptional({ example: 'https://docs.example.com' })
  link!: string | null;

  @ApiPropertyOptional({ example: 'USER' })
  targetRole!: string | null;

  @ApiProperty({ example: [] })
  targetUuids!: string[];

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  createdByUuid!: string;

  @ApiProperty({ example: 'SUPER_ADMIN' })
  createdByRole!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  expiresAt!: Date | null;

  @ApiProperty({ example: '2026-04-16T12:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-04-16T12:00:00.000Z' })
  updatedAt!: Date;
}
