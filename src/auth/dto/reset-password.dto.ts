import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  Length,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email address' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @ApiProperty({
    example: '123456',
    description: '6-digit OTP from reset email',
  })
  @IsString()
  @IsNotEmpty({ message: 'OTP is required' })
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'OTP must be a 6-digit number' })
  otp!: string;

  @ApiProperty({
    example: 'NewPassword123!',
    description: 'New password (min 8 chars)',
  })
  @IsString()
  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  newPassword!: string;
}
