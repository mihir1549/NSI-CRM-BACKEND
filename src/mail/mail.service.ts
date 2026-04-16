import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  IEmailService,
  EMAIL_SERVICE_TOKEN,
} from './providers/mail-provider.interface.js';

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
      this.emailProvider
        .sendOtpEmail(to, otp, 'verification')
        .catch((error: Error) => {
          this.logger.error(`Failed to send OTP to ${to}: ${error.message}`);
        });
    } else {
      this.emailProvider.sendOTP(to, name, otp).catch((error: Error) => {
        this.logger.error(
          `Failed to send legacy OTP to ${to}: ${error.message}`,
        );
      });
    }
  }

  /**
   * Send welcome email — fire and forget.
   */
  sendWelcome(to: string, name: string): void {
    if (this.emailProvider.sendWelcomeEmail) {
      this.emailProvider.sendWelcomeEmail(to, name).catch((error: Error) => {
        this.logger.error(
          `Failed to send welcome email to ${to}: ${error.message}`,
        );
      });
    } else {
      this.emailProvider.sendWelcome(to, name).catch((error: Error) => {
        this.logger.error(
          `Failed to send legacy welcome email to ${to}: ${error.message}`,
        );
      });
    }
  }

  /**
   * Send a password reset OTP email — fire and forget.
   */
  sendPasswordResetOTP(to: string, name: string, otp: string): void {
    if (this.emailProvider.sendOtpEmail) {
      this.emailProvider
        .sendOtpEmail(to, otp, 'password-reset')
        .catch((error: Error) => {
          this.logger.error(
            `Failed to send password reset OTP to ${to}: ${error.message}`,
          );
        });
    } else {
      this.emailProvider
        .sendPasswordResetOTP(to, name, otp)
        .catch((error: Error) => {
          this.logger.error(
            `Failed to send legacy password reset OTP to ${to}: ${error.message}`,
          );
        });
    }
  }

  /**
   * Send a password changed confirmation email — fire and forget.
   */
  sendPasswordChangedEmail(to: string, name: string): void {
    if (this.emailProvider.sendPasswordChangedEmail) {
      this.emailProvider
        .sendPasswordChangedEmail(to, name)
        .catch((error: Error) => {
          this.logger.error(
            `Failed to send password changed email to ${to}: ${error.message}`,
          );
        });
    } else {
      this.logger.warn(
        `Provider does not support sendPasswordChangedEmail (Target: ${to})`,
      );
    }
  }

  /**
   * Enroll user in nurture email sequence after they answer NO on decision step. Fire and forget.
   * Sends a real email via the configured provider (Resend in production).
   */
  sendNurtureSequence(to: string, name: string): void {
    if (this.emailProvider.sendNurtureEmail) {
      this.emailProvider.sendNurtureEmail(to, name).catch((error: Error) => {
        this.logger.error(
          `Failed to send nurture email to ${to}: ${error.message}`,
        );
      });
    } else {
      this.logger.warn(
        `Provider does not support sendNurtureEmail — nurture email not sent to ${to}`,
      );
    }
  }

  /**
   * Send nurture Day 1 email (cron-triggered, ~1 day after NO decision). Fire and forget.
   */
  sendNurtureDay1(to: string, name: string): void {
    if (this.emailProvider.sendNurtureDay1Email) {
      this.emailProvider
        .sendNurtureDay1Email(to, name)
        .catch((error: Error) => {
          this.logger.error(
            `Failed to send nurture Day 1 email to ${to}: ${error.message}`,
          );
        });
    } else {
      this.logger.warn(
        `Provider does not support sendNurtureDay1Email — Day 1 nurture not sent to ${to}`,
      );
    }
  }

  /**
   * Send nurture Day 3 email (cron-triggered, ~3 days after NO decision). Fire and forget.
   */
  sendNurtureDay3(to: string, name: string): void {
    if (this.emailProvider.sendNurtureDay3Email) {
      this.emailProvider
        .sendNurtureDay3Email(to, name)
        .catch((error: Error) => {
          this.logger.error(
            `Failed to send nurture Day 3 email to ${to}: ${error.message}`,
          );
        });
    } else {
      this.logger.warn(
        `Provider does not support sendNurtureDay3Email — Day 3 nurture not sent to ${to}`,
      );
    }
  }

  /**
   * Send nurture Day 7 email (cron-triggered, ~7 days after NO decision, final). Fire and forget.
   */
  sendNurtureDay7(to: string, name: string): void {
    if (this.emailProvider.sendNurtureDay7Email) {
      this.emailProvider
        .sendNurtureDay7Email(to, name)
        .catch((error: Error) => {
          this.logger.error(
            `Failed to send nurture Day 7 email to ${to}: ${error.message}`,
          );
        });
    } else {
      this.logger.warn(
        `Provider does not support sendNurtureDay7Email — Day 7 nurture not sent to ${to}`,
      );
    }
  }

  /**
   * Send certificate ready email after LMS course completion. Fire and forget.
   */
  sendCertificateReady(
    to: string,
    name: string,
    courseName: string,
    certificateUrl: string,
  ): void {
    if (this.emailProvider.sendCertificateReadyEmail) {
      this.emailProvider
        .sendCertificateReadyEmail(to, name, courseName, certificateUrl)
        .catch((error: Error) => {
          this.logger.error(
            `Failed to send certificate email to ${to}: ${error.message}`,
          );
        });
    } else {
      this.logger.warn(
        `Provider does not support sendCertificateReadyEmail — certificate email not sent to ${to}`,
      );
    }
  }

  /**
   * Send account suspension notification email — fire and forget.
   */
  sendSuspensionEmail(to: string, name: string, suspendedAt: string): void {
    if (this.emailProvider.sendSuspensionEmail) {
      this.emailProvider
        .sendSuspensionEmail(to, name, suspendedAt)
        .catch((error: Error) => {
          this.logger.error(
            `Failed to send suspension email to ${to}: ${error.message}`,
          );
        });
    } else {
      this.logger.warn(
        `Provider does not support sendSuspensionEmail — not sent to ${to}`,
      );
    }
  }

  /**
   * Send account reactivation notification email — fire and forget.
   */
  sendReactivationEmail(to: string, name: string): void {
    if (this.emailProvider.sendReactivationEmail) {
      this.emailProvider
        .sendReactivationEmail(to, name)
        .catch((error: Error) => {
          this.logger.error(
            `Failed to send reactivation email to ${to}: ${error.message}`,
          );
        });
    } else {
      this.logger.warn(
        `Provider does not support sendReactivationEmail — not sent to ${to}`,
      );
    }
  }

  // ─── Module 6: Distributor emails ─────────────────────

  /**
   * Send distributor subscription active email — fire and forget.
   */
  sendSubscriptionActiveEmail(
    to: string,
    data: {
      fullName: string;
      planName: string;
      amount: number;
      nextBillingDate: string;
      joinLink: string;
    },
  ): void {
    if (this.emailProvider.sendSubscriptionActiveEmail) {
      this.emailProvider
        .sendSubscriptionActiveEmail(to, data)
        .catch((error: Error) => {
          this.logger.error(
            `Failed to send subscription_active email to ${to}: ${error.message}`,
          );
        });
    } else {
      this.logger.warn(
        `Provider does not support sendSubscriptionActiveEmail — not sent to ${to}`,
      );
    }
  }

  /**
   * Send distributor subscription warning email — fire and forget.
   */
  sendSubscriptionWarningEmail(
    to: string,
    data: { fullName: string; graceDeadline: string; paymentMethodUrl: string },
  ): void {
    if (this.emailProvider.sendSubscriptionWarningEmail) {
      this.emailProvider
        .sendSubscriptionWarningEmail(to, data)
        .catch((error: Error) => {
          this.logger.error(
            `Failed to send subscription_warning email to ${to}: ${error.message}`,
          );
        });
    } else {
      this.logger.warn(
        `Provider does not support sendSubscriptionWarningEmail — not sent to ${to}`,
      );
    }
  }

  /**
   * Send distributor subscription expired email — fire and forget.
   */
  sendSubscriptionExpiredEmail(
    to: string,
    data: { fullName: string; resubscribeUrl: string },
  ): void {
    if (this.emailProvider.sendSubscriptionExpiredEmail) {
      this.emailProvider
        .sendSubscriptionExpiredEmail(to, data)
        .catch((error: Error) => {
          this.logger.error(
            `Failed to send subscription_expired email to ${to}: ${error.message}`,
          );
        });
    } else {
      this.logger.warn(
        `Provider does not support sendSubscriptionExpiredEmail — not sent to ${to}`,
      );
    }
  }

  /**
   * Send distributor subscription cancelled by admin email — fire and forget.
   */
  sendSubscriptionCancelledByAdminEmail(to: string, name: string): void {
    if (this.emailProvider.sendSubscriptionCancelledByAdminEmail) {
      this.emailProvider
        .sendSubscriptionCancelledByAdminEmail(to, name)
        .catch((error: Error) => {
          this.logger.error(
            `Failed to send subscription_cancelled_by_admin email to ${to}: ${error.message}`,
          );
        });
    } else {
      this.logger.warn(
        `Provider does not support sendSubscriptionCancelledByAdminEmail — not sent to ${to}`,
      );
    }
  }

  /**
   * Send distributor subscription invoice email after successful charge — fire and forget.
   */
  sendSubscriptionInvoiceEmail(
    to: string,
    data: {
      fullName: string;
      invoiceNumber: string;
      amount: number;
      planName: string;
      billingDate: string;
      nextBillingDate: string;
      invoiceUrl?: string | null;
    },
  ): void {
    if (this.emailProvider.sendSubscriptionInvoiceEmail) {
      this.emailProvider
        .sendSubscriptionInvoiceEmail(to, data)
        .catch((error: Error) => {
          this.logger.error(
            `Failed to send subscription_invoice email to ${to}: ${error.message}`,
          );
        });
    } else {
      this.logger.warn(
        `Provider does not support sendSubscriptionInvoiceEmail — not sent to ${to}`,
      );
    }
  }

  /**
   * Send grace period reminder email — fire and forget.
   */
  sendSubscriptionGraceReminderEmail(
    to: string,
    data: { fullName: string; graceDeadline: string; paymentMethodUrl: string },
  ): void {
    if (this.emailProvider.sendSubscriptionGraceReminderEmail) {
      this.emailProvider
        .sendSubscriptionGraceReminderEmail(to, data)
        .catch((error: Error) => {
          this.logger.error(
            `Failed to send subscription_grace_reminder email to ${to}: ${error.message}`,
          );
        });
    } else {
      this.logger.warn(
        `Provider does not support sendSubscriptionGraceReminderEmail — not sent to ${to}`,
      );
    }
  }

  /**
   * Send self-cancellation confirmation email — fire and forget.
   */
  sendSubscriptionSelfCancelledEmail(
    to: string,
    data: { fullName: string; accessUntil: string; planName: string },
  ): void {
    if (this.emailProvider.sendSubscriptionSelfCancelledEmail) {
      this.emailProvider
        .sendSubscriptionSelfCancelledEmail(to, data)
        .catch((error: Error) => {
          this.logger.error(
            `Failed to send subscription_self_cancelled email to ${to}: ${error.message}`,
          );
        });
    } else {
      this.logger.warn(
        `Provider does not support sendSubscriptionSelfCancelledEmail — not sent to ${to}`,
      );
    }
  }

  /**
   * Send subscription reactivated email (after admin reactivates) — fire and forget.
   */
  sendSubscriptionReactivatedEmail(
    to: string,
    data: {
      fullName: string;
      planName: string;
      amount: number;
      nextBillingDate: string;
      joinLink: string;
    },
  ): void {
    if (this.emailProvider.sendSubscriptionReactivatedEmail) {
      this.emailProvider
        .sendSubscriptionReactivatedEmail(to, data)
        .catch((error: Error) => {
          this.logger.error(
            `Failed to send subscription_reactivated email to ${to}: ${error.message}`,
          );
        });
    } else {
      this.logger.warn(
        `Provider does not support sendSubscriptionReactivatedEmail — not sent to ${to}`,
      );
    }
  }

  // ─── Plan migration emails ────────────────────────────

  /**
   * Email 1: Plan migration notice — plan is being discontinued. Fire and forget.
   */
  sendSubscriptionMigrationNoticeEmail(
    to: string,
    data: { fullName: string; currentPeriodEnd: string; newPlanUrl: string },
  ): void {
    if (this.emailProvider.sendSubscriptionMigrationNoticeEmail) {
      this.emailProvider
        .sendSubscriptionMigrationNoticeEmail(to, data)
        .catch((error: Error) => {
          this.logger.error(
            `Failed to send migration_notice email to ${to}: ${error.message}`,
          );
        });
    } else {
      this.logger.warn(
        `Provider does not support sendSubscriptionMigrationNoticeEmail — not sent to ${to}`,
      );
    }
  }

  /**
   * Email 2: Plan migration reminder — 3 days left. Fire and forget.
   */
  sendSubscriptionMigrationReminderEmail(
    to: string,
    data: { fullName: string; currentPeriodEnd: string; newPlanUrl: string },
  ): void {
    if (this.emailProvider.sendSubscriptionMigrationReminderEmail) {
      this.emailProvider
        .sendSubscriptionMigrationReminderEmail(to, data)
        .catch((error: Error) => {
          this.logger.error(
            `Failed to send migration_reminder email to ${to}: ${error.message}`,
          );
        });
    } else {
      this.logger.warn(
        `Provider does not support sendSubscriptionMigrationReminderEmail — not sent to ${to}`,
      );
    }
  }

  /**
   * Email 3: Plan migration ended — grace period started. Fire and forget.
   */
  sendSubscriptionMigrationEndedEmail(
    to: string,
    data: { fullName: string; graceDeadline: string; newPlanUrl: string },
  ): void {
    if (this.emailProvider.sendSubscriptionMigrationEndedEmail) {
      this.emailProvider
        .sendSubscriptionMigrationEndedEmail(to, data)
        .catch((error: Error) => {
          this.logger.error(
            `Failed to send migration_ended email to ${to}: ${error.message}`,
          );
        });
    } else {
      this.logger.warn(
        `Provider does not support sendSubscriptionMigrationEndedEmail — not sent to ${to}`,
      );
    }
  }
}
