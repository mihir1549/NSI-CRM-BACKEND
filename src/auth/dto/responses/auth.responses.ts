import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthUserDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  uuid!: string;

  @ApiProperty({ example: 'Nageshwar Shukla' })
  fullName!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({ example: 'USER', enum: ['USER', 'CUSTOMER', 'DISTRIBUTOR', 'ADMIN', 'SUPER_ADMIN'] })
  role!: string;

  @ApiProperty({ example: 'ACTIVE', enum: ['REGISTERED', 'EMAIL_VERIFIED', 'PROFILE_INCOMPLETE', 'ACTIVE', 'SUSPENDED'] })
  status!: string;

  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/example/avatar.jpg', nullable: true })
  avatarUrl!: string | null;
}

export class AuthMeUserDto extends AuthUserDto {
  @ApiPropertyOptional({ example: 'IN', nullable: true })
  country!: string | null;
}

export class AuthResponse {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken!: string;

  @ApiProperty({ example: false, description: 'True if user has not set their country yet' })
  needsCountry!: boolean;

  @ApiProperty({ type: () => AuthUserDto })
  user!: AuthUserDto;
}

export class MeResponse {
  @ApiProperty({ type: () => AuthMeUserDto })
  user!: AuthMeUserDto;
}

export class AvatarUploadResponse {
  @ApiProperty({ example: 'https://res.cloudinary.com/example/avatars/user-uuid.jpg' })
  avatarUrl!: string;
}
