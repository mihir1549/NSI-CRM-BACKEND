import { IsString, IsIn, IsOptional, Matches } from 'class-validator';

export class SendOtpDto {
  @IsString()
  phone: string; // Will be normalized to E.164 in service

  @IsOptional()
  @IsIn(['whatsapp', 'sms'])
  channel: 'whatsapp' | 'sms' = 'whatsapp';
}

export class VerifyPhoneOtpDto {
  @IsString()
  phone: string; // Will be normalized to E.164 in service

  @IsString()
  @Matches(/^\d{6}$/, { message: 'OTP must be exactly 6 digits' })
  code: string;

  @IsIn(['whatsapp', 'sms'])
  channel: 'whatsapp' | 'sms';
}
