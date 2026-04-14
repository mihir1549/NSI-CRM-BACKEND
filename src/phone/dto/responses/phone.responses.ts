import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PhoneMessageResponse {
  @ApiProperty({ example: 'OTP sent successfully' })
  message!: string;

  @ApiPropertyOptional({ example: 'sms' })
  channel?: string;
}

export class PhoneVerifyProgress {
  @ApiProperty({ example: true })
  phoneVerified!: boolean;

  @ApiProperty({ example: false })
  paymentCompleted!: boolean;

  @ApiPropertyOptional({ example: 'step_uuid_123' })
  currentStepUuid!: string | null;

  @ApiPropertyOptional({ example: 'section_uuid_123' })
  currentSectionUuid!: string | null;
}

export class PhoneVerifyResponse {
  @ApiProperty({ example: 'Phone verified successfully' })
  message!: string;

  @ApiProperty({ type: PhoneVerifyProgress })
  progress!: PhoneVerifyProgress;
}
