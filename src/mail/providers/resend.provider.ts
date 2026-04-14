import { Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { IEmailService } from './mail-provider.interface.js';
import { getOtpEmailTemplate, otpEmailTemplate } from '../templates/otp.template.js';
import { getWelcomeEmailTemplate, welcomeEmailTemplate } from '../templates/welcome.template.js';
import { getPasswordChangedEmailTemplate } from '../templates/password-changed.template.js';
import { passwordResetEmailTemplate } from '../templates/password-reset.template.js';
import { getNurtureEmailTemplate } from '../templates/nurture.template.js';
import { getNurtureDay1Template } from '../templates/nurture-day1.template.js';
import { getNurtureDay3Template } from '../templates/nurture-day3.template.js';
import { getNurtureDay7Template } from '../templates/nurture-day7.template.js';
import { getSuspensionEmailTemplate } from '../templates/suspension.template.js';
import { getReactivationEmailTemplate } from '../templates/reactivation.template.js';
import { getSubscriptionActiveTemplate } from '../templates/subscription-active.template.js';
import { getSubscriptionInvoiceTemplate } from '../templates/subscription-invoice.template.js';
import { getSubscriptionWarningTemplate } from '../templates/subscription-warning.template.js';
import { getSubscriptionGraceReminderTemplate } from '../templates/subscription-grace-reminder.template.js';
import { getSubscriptionExpiredTemplate } from '../templates/subscription-expired.template.js';
import { getSubscriptionSelfCancelledTemplate } from '../templates/subscription-self-cancelled.template.js';
import { getSubscriptionCancelledAdminTemplate } from '../templates/subscription-cancelled-admin.template.js';
import { getSubscriptionReactivatedTemplate } from '../templates/subscription-reactivated.template.js';
import { getSubscriptionMigrationNoticeTemplate } from '../templates/subscription-migration-notice.template.js';
import { getSubscriptionMigrationReminderTemplate } from '../templates/subscription-migration-reminder.template.js';
import { getSubscriptionMigrationEndedTemplate } from '../templates/subscription-migration-ended.template.js';

/**
 * Resend email provider for production.
 * Sends real emails via Resend API.
 * Used when MAIL_PROVIDER=resend.
 *
 * Logo is loaded from CDN (base-email.template.ts) — no local attachments.
 */
export class ResendEmailService implements IEmailService {
  private readonly logger = new Logger(ResendEmailService.name);
  private readonly resend: Resend;
  private readonly fromAddress: string;

  constructor(apiKey: string, fromAddress: string) {
    this.resend = new Resend(apiKey);
    this.fromAddress = fromAddress;
  }

  // --- NEW PREFERRED METHODS ---

  async sendOtpEmail(to: string, otp: string, type: 'verification' | 'password-reset'): Promise<void> {
    try {
      const template = getOtpEmailTemplate(otp, type);
      await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject: template.subject,
        html: template.html,
      });
      this.logger.log(`[Resend] OTP email sent to ${to}: ${template.subject}`);
    } catch (error) {
      this.logger.error(
        `[Resend] Failed to send OTP email to ${to}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    try {
      const template = getWelcomeEmailTemplate(name);
      await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject: template.subject,
        html: template.html,
      });
      this.logger.log(`[Resend] Welcome email sent to ${to}: ${template.subject}`);
    } catch (error) {
      this.logger.error(
        `[Resend] Failed to send welcome email to ${to}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async sendPasswordChangedEmail(to: string, name: string): Promise<void> {
    try {
      const template = getPasswordChangedEmailTemplate(name);
      await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject: template.subject,
        html: template.html,
      });
      this.logger.log(`[Resend] Password changed email sent to ${to}: ${template.subject}`);
    } catch (error) {
      this.logger.error(
        `[Resend] Failed to send password changed email to ${to}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async sendNurtureEmail(to: string, name: string): Promise<void> {
    try {
      const template = getNurtureEmailTemplate(name);
      await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject: template.subject,
        html: template.html,
      });
      this.logger.log(`[Resend] Nurture email sent to ${to}`);
    } catch (error) {
      this.logger.error(
        `[Resend] Failed to send nurture email to ${to}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async sendNurtureDay1Email(to: string, name: string): Promise<void> {
    try {
      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
      const template = getNurtureDay1Template(name, frontendUrl);
      await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject: template.subject,
        html: template.html,
      });
      this.logger.log(`[Resend] Nurture Day 1 email sent to ${to}`);
    } catch (error) {
      this.logger.error(
        `[Resend] Failed to send nurture Day 1 email to ${to}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async sendNurtureDay3Email(to: string, name: string): Promise<void> {
    try {
      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
      const template = getNurtureDay3Template(name, frontendUrl);
      await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject: template.subject,
        html: template.html,
      });
      this.logger.log(`[Resend] Nurture Day 3 email sent to ${to}`);
    } catch (error) {
      this.logger.error(
        `[Resend] Failed to send nurture Day 3 email to ${to}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async sendNurtureDay7Email(to: string, name: string): Promise<void> {
    try {
      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
      const template = getNurtureDay7Template(name, frontendUrl);
      await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject: template.subject,
        html: template.html,
      });
      this.logger.log(`[Resend] Nurture Day 7 email sent to ${to}`);
    } catch (error) {
      this.logger.error(
        `[Resend] Failed to send nurture Day 7 email to ${to}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async sendSuspensionEmail(to: string, name: string, suspendedAt: string): Promise<void> {
    try {
      const template = getSuspensionEmailTemplate(name, suspendedAt);
      await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject: template.subject,
        html: template.html,
      });
      this.logger.log(`[Resend] Suspension email sent to ${to}`);
    } catch (error) {
      this.logger.error(
        `[Resend] Failed to send suspension email to ${to}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async sendReactivationEmail(to: string, name: string): Promise<void> {
    try {
      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
      const template = getReactivationEmailTemplate(name, frontendUrl);
      await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject: template.subject,
        html: template.html,
      });
      this.logger.log(`[Resend] Reactivation email sent to ${to}`);
    } catch (error) {
      this.logger.error(
        `[Resend] Failed to send reactivation email to ${to}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  // --- MODULE 6: DISTRIBUTOR SUBSCRIPTION EMAILS ---

  async sendSubscriptionActiveEmail(
    to: string,
    data: { fullName: string; planName: string; amount: number; nextBillingDate: string; joinLink: string },
  ): Promise<void> {
    try {
      const template = getSubscriptionActiveTemplate(data);
      await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject: template.subject,
        html: template.html,
      });
      this.logger.log(`[Resend] Subscription active email sent to ${to}`);
    } catch (error) {
      this.logger.error(
        `[Resend] Failed to send subscription_active email to ${to}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async sendSubscriptionInvoiceEmail(
    to: string,
    data: { fullName: string; invoiceNumber: string; amount: number; planName: string; billingDate: string; nextBillingDate: string; invoiceUrl?: string | null },
  ): Promise<void> {
    try {
      const template = getSubscriptionInvoiceTemplate(data);
      let attachments: Array<{ filename: string; content: Buffer }> = [];
      if (data.invoiceUrl) {
        try {
          const response = await fetch(data.invoiceUrl);
          const buffer = Buffer.from(await response.arrayBuffer());
          attachments = [{ filename: `${data.invoiceNumber}.pdf`, content: buffer }];
        } catch (err) {
          this.logger.warn(
            `Could not fetch invoice PDF for attachment: ${err instanceof Error ? err.message : 'Unknown error'}`,
          );
        }
      }
      await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject: template.subject,
        html: template.html,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      this.logger.log(`[Resend] Subscription invoice email sent to ${to}`);
    } catch (error) {
      this.logger.error(
        `[Resend] Failed to send subscription_invoice email to ${to}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async sendSubscriptionWarningEmail(
    to: string,
    data: { fullName: string; graceDeadline: string; paymentMethodUrl: string },
  ): Promise<void> {
    try {
      const template = getSubscriptionWarningTemplate(data);
      await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject: template.subject,
        html: template.html,
      });
      this.logger.log(`[Resend] Subscription warning email sent to ${to}`);
    } catch (error) {
      this.logger.error(
        `[Resend] Failed to send subscription_warning email to ${to}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async sendSubscriptionGraceReminderEmail(
    to: string,
    data: { fullName: string; graceDeadline: string; paymentMethodUrl: string },
  ): Promise<void> {
    try {
      const template = getSubscriptionGraceReminderTemplate(data);
      await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject: template.subject,
        html: template.html,
      });
      this.logger.log(`[Resend] Subscription grace reminder email sent to ${to}`);
    } catch (error) {
      this.logger.error(
        `[Resend] Failed to send subscription_grace_reminder email to ${to}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async sendSubscriptionExpiredEmail(
    to: string,
    data: { fullName: string; resubscribeUrl: string },
  ): Promise<void> {
    try {
      const template = getSubscriptionExpiredTemplate(data);
      await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject: template.subject,
        html: template.html,
      });
      this.logger.log(`[Resend] Subscription expired email sent to ${to}`);
    } catch (error) {
      this.logger.error(
        `[Resend] Failed to send subscription_expired email to ${to}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async sendSubscriptionSelfCancelledEmail(
    to: string,
    data: { fullName: string; accessUntil: string; planName: string },
  ): Promise<void> {
    try {
      const template = getSubscriptionSelfCancelledTemplate(data);
      await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject: template.subject,
        html: template.html,
      });
      this.logger.log(`[Resend] Subscription self-cancelled email sent to ${to}`);
    } catch (error) {
      this.logger.error(
        `[Resend] Failed to send subscription_self_cancelled email to ${to}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async sendSubscriptionCancelledByAdminEmail(to: string, name: string): Promise<void> {
    try {
      const template = getSubscriptionCancelledAdminTemplate({ fullName: name });
      await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject: template.subject,
        html: template.html,
      });
      this.logger.log(`[Resend] Subscription cancelled-by-admin email sent to ${to}`);
    } catch (error) {
      this.logger.error(
        `[Resend] Failed to send subscription_cancelled_by_admin email to ${to}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async sendSubscriptionReactivatedEmail(
    to: string,
    data: { fullName: string; planName: string; amount: number; nextBillingDate: string; joinLink: string },
  ): Promise<void> {
    try {
      const template = getSubscriptionReactivatedTemplate(data);
      await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject: template.subject,
        html: template.html,
      });
      this.logger.log(`[Resend] Subscription reactivated email sent to ${to}`);
    } catch (error) {
      this.logger.error(
        `[Resend] Failed to send subscription_reactivated email to ${to}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  // --- PLAN MIGRATION EMAILS ---

  async sendSubscriptionMigrationNoticeEmail(
    to: string,
    data: { fullName: string; currentPeriodEnd: string; newPlanUrl: string },
  ): Promise<void> {
    try {
      const template = getSubscriptionMigrationNoticeTemplate(data);
      await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject: template.subject,
        html: template.html,
      });
      this.logger.log(`[Resend] Migration notice email sent to ${to}`);
    } catch (error) {
      this.logger.error(
        `[Resend] Failed to send migration_notice email to ${to}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async sendSubscriptionMigrationReminderEmail(
    to: string,
    data: { fullName: string; currentPeriodEnd: string; newPlanUrl: string },
  ): Promise<void> {
    try {
      const template = getSubscriptionMigrationReminderTemplate(data);
      await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject: template.subject,
        html: template.html,
      });
      this.logger.log(`[Resend] Migration reminder email sent to ${to}`);
    } catch (error) {
      this.logger.error(
        `[Resend] Failed to send migration_reminder email to ${to}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async sendSubscriptionMigrationEndedEmail(
    to: string,
    data: { fullName: string; graceDeadline: string; newPlanUrl: string },
  ): Promise<void> {
    try {
      const template = getSubscriptionMigrationEndedTemplate(data);
      await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject: template.subject,
        html: template.html,
      });
      this.logger.log(`[Resend] Migration ended email sent to ${to}`);
    } catch (error) {
      this.logger.error(
        `[Resend] Failed to send migration_ended email to ${to}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  // --- LEGACY BACKWARDS COMPATIBILITY METHODS ---

  async sendOTP(to: string, name: string, otp: string): Promise<void> {
    try {
      await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject: 'Verify your email — Growith NSI',
        html: otpEmailTemplate(name, otp),
      });
      this.logger.log(`[Resend] Legacy OTP email sent to ${to}`);
    } catch (error) {
      this.logger.error(
        `[Resend] Failed to send legacy OTP email to ${to}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async sendWelcome(to: string, name: string): Promise<void> {
    try {
      await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject: 'Welcome to Growith NSI!',
        html: welcomeEmailTemplate(name),
      });
      this.logger.log(`[Resend] Legacy Welcome email sent to ${to}`);
    } catch (error) {
      this.logger.error(
        `[Resend] Failed to send legacy welcome email to ${to}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async sendPasswordResetOTP(to: string, name: string, otp: string): Promise<void> {
    try {
      await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject: 'Reset your password — Growith NSI',
        html: passwordResetEmailTemplate(name, otp),
      });
      this.logger.log(`[Resend] Legacy Password reset OTP email sent to ${to}`);
    } catch (error) {
      this.logger.error(
        `[Resend] Failed to send legacy password reset OTP email to ${to}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
