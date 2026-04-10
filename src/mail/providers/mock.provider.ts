import { Logger } from '@nestjs/common';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { IEmailService } from './mail-provider.interface.js';
import { otpEmailTemplate } from '../templates/otp.template.js';
import { welcomeEmailTemplate } from '../templates/welcome.template.js';
import { passwordResetEmailTemplate } from '../templates/password-reset.template.js';

/**
 * Mock email provider for local development.
 * Logs OTP to console instead of sending real emails.
 * Used when MAIL_PROVIDER=mock.
 */
export class MockEmailService implements IEmailService {
  private readonly logger = new Logger(MockEmailService.name);

  async sendOTP(to: string, name: string, otp: string): Promise<void> {
    // Intentionally logging the OTP in dev — this is the ONLY place raw OTP is visible
    this.logger.warn(
      `[MOCK EMAIL] OTP for ${to} is ${otp}`,
    );
    writeFileSync(resolve(process.cwd(), 'test-otp.txt'), otp);
    this.logger.debug(`[MOCK EMAIL] Template would be sent to: ${name} <${to}>`);
    // Template is generated but not sent — useful for template debugging
    otpEmailTemplate(name, otp);
  }

  async sendWelcome(to: string, name: string): Promise<void> {
    this.logger.warn(
      `[MOCK EMAIL] Welcome email for ${to} (${name})`,
    );
    welcomeEmailTemplate(name);
  }

  async sendPasswordResetOTP(to: string, name: string, otp: string): Promise<void> {
    this.logger.warn(
      `[MOCK EMAIL] Password Reset OTP for ${to} is ${otp}`,
    );
    writeFileSync(resolve(process.cwd(), 'test-otp.txt'), otp);
    this.logger.debug(`[MOCK EMAIL] Template would be sent to: ${name} <${to}>`);
    passwordResetEmailTemplate(name, otp);
  }

  async sendNurtureDay1Email(to: string, name: string): Promise<void> {
    this.logger.warn(`[MOCK EMAIL] Nurture Day 1 email for ${to} (${name})`);
  }

  async sendNurtureDay3Email(to: string, name: string): Promise<void> {
    this.logger.warn(`[MOCK EMAIL] Nurture Day 3 email for ${to} (${name})`);
  }

  async sendNurtureDay7Email(to: string, name: string): Promise<void> {
    this.logger.warn(`[MOCK EMAIL] Nurture Day 7 email for ${to} (${name})`);
  }

  async sendCertificateReadyEmail(
    to: string,
    name: string,
    courseName: string,
    certificateUrl: string,
  ): Promise<void> {
    this.logger.warn(
      `[MOCK EMAIL] Certificate ready for ${to} (${name}) — course: "${courseName}" — url: ${certificateUrl}`,
    );
  }

  async sendSuspensionEmail(to: string, name: string, suspendedAt: string): Promise<void> {
    this.logger.warn(`[MOCK EMAIL] Account suspended for ${to} (${name}) — at: ${suspendedAt}`);
  }

  async sendReactivationEmail(to: string, name: string): Promise<void> {
    this.logger.warn(`[MOCK EMAIL] Account reactivated for ${to} (${name})`);
  }

  async sendSubscriptionActiveEmail(
    to: string,
    _data: { fullName: string; planName: string; amount: number; nextBillingDate: string; joinLink: string },
  ): Promise<void> {
    this.logger.warn(`[MOCK EMAIL] Subscription active for ${to}`);
  }

  async sendSubscriptionWarningEmail(
    to: string,
    _data: { fullName: string; graceDeadline: string; paymentMethodUrl: string },
  ): Promise<void> {
    this.logger.warn(`[MOCK EMAIL] Subscription warning for ${to}`);
  }

  async sendSubscriptionExpiredEmail(
    to: string,
    _data: { fullName: string; resubscribeUrl: string },
  ): Promise<void> {
    this.logger.warn(`[MOCK EMAIL] Subscription expired for ${to}`);
  }

  async sendSubscriptionCancelledByAdminEmail(to: string, name: string): Promise<void> {
    this.logger.warn(`[MOCK EMAIL] Subscription cancelled by admin for ${to} (${name})`);
  }

  async sendSubscriptionInvoiceEmail(
    to: string,
    _data: { fullName: string; invoiceNumber: string; amount: number; planName: string; billingDate: string; nextBillingDate: string; invoiceUrl?: string | null },
  ): Promise<void> {
    console.log(`[MOCK MAIL] sendSubscriptionInvoiceEmail to ${to}`);
  }

  async sendSubscriptionGraceReminderEmail(
    to: string,
    _data: { fullName: string; graceDeadline: string; paymentMethodUrl: string },
  ): Promise<void> {
    console.log(`[MOCK MAIL] sendSubscriptionGraceReminderEmail to ${to}`);
  }

  async sendSubscriptionSelfCancelledEmail(
    to: string,
    _data: { fullName: string; accessUntil: string; planName: string },
  ): Promise<void> {
    console.log(`[MOCK MAIL] sendSubscriptionSelfCancelledEmail to ${to}`);
  }

  async sendSubscriptionReactivatedEmail(
    to: string,
    _data: { fullName: string; planName: string; amount: number; nextBillingDate: string; joinLink: string },
  ): Promise<void> {
    console.log(`[MOCK MAIL] sendSubscriptionReactivatedEmail to ${to}`);
  }
}

