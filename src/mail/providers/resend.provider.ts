import { Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
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

/**
 * Resend email provider for production.
 * Sends real emails via Resend API.
 * Used when MAIL_PROVIDER=resend.
 */
export class ResendEmailService implements IEmailService {
  private readonly logger = new Logger(ResendEmailService.name);
  private readonly resend: Resend;
  private readonly fromAddress: string;
  private readonly inlineLogoAttachment = this.loadInlineLogoAttachment();

  constructor(apiKey: string, fromAddress: string) {
    this.resend = new Resend(apiKey);
    this.fromAddress = fromAddress;
  }

  private loadInlineLogoAttachment():
    | {
        filename: string;
        content: string;
        contentType: string;
        contentId: string;
      }
    | undefined {
    const candidates = [
      resolve(process.cwd(), 'dist', 'assets', 'ONLY NSI.png'),
      resolve(process.cwd(), 'dist', 'src', 'assets', 'ONLY NSI.png'),
      resolve(process.cwd(), 'src', 'assets', 'ONLY NSI.png'),
    ];

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return {
          filename: 'nsi-logo.png',
          content: readFileSync(candidate).toString('base64'),
          contentType: 'image/png',
          contentId: 'nsi-logo',
        };
      }
    }

    return undefined;
  }

  // --- NEW PREFERRED METHODS ---

  async sendOtpEmail(to: string, otp: string, type: 'verification' | 'password-reset'): Promise<void> {
    try {
      const template = getOtpEmailTemplate(otp, type, {
        logoSrc: this.inlineLogoAttachment ? 'cid:nsi-logo' : undefined,
      });
      await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject: template.subject,
        html: template.html,
        attachments: this.inlineLogoAttachment ? [this.inlineLogoAttachment] : undefined,
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
      const template = getWelcomeEmailTemplate(name, {
        logoSrc: this.inlineLogoAttachment ? 'cid:nsi-logo' : undefined,
      });
      await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject: template.subject,
        html: template.html,
        attachments: this.inlineLogoAttachment ? [this.inlineLogoAttachment] : undefined,
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
      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3001';
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
      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3001';
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
      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3001';
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
      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3001';
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

  // --- LEGACY BACKWARDS COMPATIBILITY METHODS ---

  async sendOTP(to: string, name: string, otp: string): Promise<void> {
    try {
      await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject: 'Verify your email — NSI Platform',
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
        subject: 'Welcome to NSI Platform!',
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
        subject: 'Reset your password — NSI Platform',
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
