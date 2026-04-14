import { getOtpEmailTemplate } from './otp.template.js';

export function passwordResetEmailTemplate(name: string, otp: string): string {
  void name;
  return getOtpEmailTemplate(otp, 'password-reset').html;
}
