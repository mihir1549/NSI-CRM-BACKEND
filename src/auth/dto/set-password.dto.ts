import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SetPasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  newPassword!: string;
}
