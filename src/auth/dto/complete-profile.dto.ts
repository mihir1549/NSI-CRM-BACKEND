import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CompleteProfileDto {
  @IsString()
  @IsNotEmpty({ message: 'Country code is required' })
  @Length(2, 2, { message: 'Country must be an ISO 3166-1 alpha-2 code (2 letters)' })
  country!: string;
}
