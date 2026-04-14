import { ApiPropertyOptional } from '@nestjs/swagger';

export class WebhookMessageResponse {
  @ApiPropertyOptional({ example: true })
  ok?: boolean;
}
