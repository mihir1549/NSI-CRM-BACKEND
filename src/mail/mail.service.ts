import { Injectable, Inject, Logger } from '@nestjs/common';
import { IEmailService, EMAIL_SERVICE_TOKEN } from './providers/mail-provider.interface.js';

/**
 * MailService is the application-facing email facade.
 * It delegates all email sending to the injected provider.
 * All send operations are fire-and-forget — they never block the caller.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @Inject(EMAIL_SERVICE_TOKEN)
    private readonly emailProvider: IEmailService,
  ) {}

  /**
   * Send OTP email (verification) — fire and forget.
   */
  sendOTP(to: string, name: string, otp: string): void {
    if (this.emailProvider.sendOtpEmail) {
      this.emailProvider.sendOtpEmail(to, otp, 'verification').catch((error: Error) => {
        this.logger.error(`Failed to send OTP to ${to}: ${error.message}`);
      });
    } else {
      this.emailProvider.sendOTP(to, name, otp).catch((error: Error) => {
        this.logger.error(`Failed to send legacy OTP to ${to}: ${error.message}`);
      });
    }
  }

  /**
   * Send welcome email — fire and forget.
   */
  sendWelcome(to: string, name: string): void {
    if (this.emailProvider.sendWelcomeEmail) {
      this.emailProvider.sendWelcomeEmail(to, name).catch((error: Error) => {
        this.logger.error(`Failed to send welcome email to ${to}: ${error.message}`);
      });
    } else {
      this.emailProvider.sendWelcome(to, name).catch((error: Error) => {
        this.logger.error(`Failed to send legacy welcome email to ${to}: ${error.message}`);
      });
    }
  }

  /**
   * Send a password reset OTP email — fire and forget.
   */
  sendPasswordResetOTP(to: string, name: string, otp: string): void {
    if (this.emailProvider.sendOtpEmail) {
      this.emailProvider.sendOtpEmail(to, otp, 'password-reset').catch((error: Error) => {
        this.logger.error(`Failed to send password reset OTP to ${to}: ${error.message}`);
      });
    } else {
      this.emailProvider.sendPasswordResetOTP(to, name, otp).catch((error: Error) => {
        this.logger.error(`Failed to send legacy password reset OTP to ${to}: ${error.message}`);
      });
    }
  }

  /**
   * Send a password changed confirmation email — fire and forget.
   */
  sendPasswordChangedEmail(to: string, name: string): void {
    if (this.emailProvider.sendPasswordChangedEmail) {
      this.emailProvider.sendPasswordChangedEmail(to, name).catch((error: Error) => {
        this.logger.error(`Failed to send password changed email to ${to}: ${error.message}`);
      });
    } else {
      this.logger.warn(`Provider does not support sendPasswordChangedEmail (Target: ${to})`);
    }
  }

  /**
   * Enroll user in nurture email sequence after they answer NO on decision step. Fire and forget.
   * Sends a real email via the configured provider (Resend in production).
   */
  sendNurtureSequence(to: string, name: string): void {
    if (this.emailProvider.sendNurtureEmail) {
      this.emailProvider.sendNurtureEmail(to, name).catch((error: Error) => {
        this.logger.error(`Failed to send nurture email to ${to}: ${error.message}`);
      });
    } else {
      this.logger.warn(`Provider does not support sendNurtureEmail — nurture email not sent to ${to}`);
    }
  }

  /**
   * Send nurture Day 1 email (cron-triggered, ~1 day after NO decision). Fire and forget.
   */
  sendNurtureDay1(to: string, name: string): void {
    if (this.emailProvider.sendNurtureDay1Email) {
      this.emailProvider.sendNurtureDay1Email(to, name).catch((error: Error) => {
        this.logger.error(`Failed to send nurture Day 1 email to ${to}: ${error.message}`);
      });
    } else {
      this.logger.warn(`Provider does not support sendNurtureDay1Email — Day 1 nurture not sent to ${to}`);
    }
  }

  /**
   * Send nurture Day 3 email (cron-triggered, ~3 days after NO decision). Fire and forget.
   */
  sendNurtureDay3(to: string, name: string): void {
    if (this.emailProvider.sendNurtureDay3Email) {
      this.emailProvider.sendNurtureDay3Email(to, name).catch((error: Error) => {
        this.logger.error(`Failed to send nurture Day 3 email to ${to}: ${error.message}`);
      });
    } else {
      this.logger.warn(`Provider does not support sendNurtureDay3Email — Day 3 nurture not sent to ${to}`);
    }
  }

  /**
   * Send nurture Day 7 email (cron-triggered, ~7 days after NO decision, final). Fire and forget.
   */
  sendNurtureDay7(to: string, name: string): void {
    if (this.emailProvider.sendNurtureDay7Email) {
      this.emailProvider.sendNurtureDay7Email(to, name).catch((error: Error) => {
        this.logger.error(`Failed to send nurture Day 7 email to ${to}: ${error.message}`);
      });
    } else {
      this.logger.warn(`Provider does not support sendNurtureDay7Email — Day 7 nurture not sent to ${to}`);
    }
  }
}

