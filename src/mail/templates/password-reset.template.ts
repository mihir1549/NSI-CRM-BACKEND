import { getOtpEmailTemplate } from './otp.template.js';

export function passwordResetEmailTemplate(name: string, otp: string): string {
  return getOtpEmailTemplate(otp, 'password-reset').html;
}
