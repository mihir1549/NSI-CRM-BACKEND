import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetPasswordDto {
  @ApiProperty({
    example: 'NewPassword123!',
    description: 'New password (min 8 chars)',
  })
  @IsString()
  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  newPassword!: string;
}
