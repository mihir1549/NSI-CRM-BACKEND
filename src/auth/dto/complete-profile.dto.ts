import { IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CompleteProfileDto {
  @ApiProperty({ example: 'IN', description: 'ISO 3166-1 alpha-2 country code (2 letters)' })
  @IsString()
  @IsNotEmpty({ message: 'Country code is required' })
  @Length(2, 2, { message: 'Country must be an ISO 3166-1 alpha-2 code (2 letters)' })
  country!: string;
}
