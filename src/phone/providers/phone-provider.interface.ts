export interface PhoneProvider {
  sendOtp(phone: string, channel: 'whatsapp' | 'sms'): Promise<void>;
  verifyOtp(
    phone: string,
    code: string,
    channel: 'whatsapp' | 'sms',
  ): Promise<boolean>;
}

export const PHONE_PROVIDER_TOKEN = 'PHONE_PROVIDER';
