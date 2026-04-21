import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EnrollDto {
  @ApiProperty({ example: true, description: 'User must accept terms' })
  @IsBoolean()
  @IsNotEmpty()
  termsAccepted: boolean;

  @ApiProperty({
    example: '2026-04-21-v1',
    description: 'Terms version displayed to user',
  })
  @IsString()
  @IsNotEmpty()
  termsVersion: string;
}
