import { ApiProperty } from '@nestjs/swagger';

export class TrackingMessageResponse {
  @ApiProperty({ example: true })
  ok!: boolean;
}
