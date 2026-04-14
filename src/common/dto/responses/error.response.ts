import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponse {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: 'Validation failed' })
  message!: string | string[];

  @ApiProperty({ example: 'Bad Request' })
  error!: string;
}

export class MessageResponse {
  @ApiProperty({ example: 'Operation successful' })
  message!: string;
}

export class DeletedResponse {
  @ApiProperty({ example: true })
  deleted!: boolean;
}

export class ReorderedResponse {
  @ApiProperty({ example: true })
  reordered!: boolean;
}
