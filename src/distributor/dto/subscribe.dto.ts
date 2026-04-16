import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubscribeDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Distributor plan UUID to subscribe to',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  planUuid: string;
}
