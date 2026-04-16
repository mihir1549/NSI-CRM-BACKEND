/**
 * Email service provider interface.
 * All email providers must implement this contract.
 * The rest of the application only interacts with this interface.
 */
export interface IEmailService {
  /**
   * Send an OTP verification email.
   * @param to - Recipient email address
   * @param name - Recipient display name
   * @param otp - The raw OTP code (provider handles template rendering)
   */
  sendOTP(to: string, name: string, otp: string): Promise<void>;

  /**
   * Send a welcome email after successful onboarding.
   * @param to - Recipient email address
   * @param name - Recipient display name
   */
  sendWelcome(to: string, name: string): Promise<void>;

  /**
   * Send a password reset OTP email.
   * @param to - Recipient email address
   * @param name - Recipient display name
   * @param otp - The raw OTP code
   */
  sendPasswordResetOTP(to: string, name: string, otp: string): Promise<void>;

  // --- NEW METHODS (Optional for backwards compatibility with mocks) ---

  /**
   * Send OTP Email (verification or password reset)
   * @param to - Recipient email address
   * @param otp - The raw OTP code
   * @param type - The type of OTP email
   */
  sendOtpEmail?(
    to: string,
    otp: string,
    type: 'verification' | 'password-reset',
  ): Promise<void>;

  /**
   * Send Welcome Email
   * @param to - Recipient email address
   * @param name - Recipient display name
   */
  sendWelcomeEmail?(to: string, name: string): Promise<void>;

  /**
   * Send Password Changed Email
   * @param to - Recipient email address
   * @param name - Recipient display name
   */
  sendPasswordChangedEmail?(to: string, name: string): Promise<void>;

  /**
   * Enroll user in nurture sequence (decision-NO flow)
   * @param to - Recipient email address
   * @param name - Recipient display name
   */
  sendNurtureEmail?(to: string, name: string): Promise<void>;

  /**
   * Send nurture Day 1 email (scheduled cron — ~1 day after NO decision)
   */
  sendNurtureDay1Email?(to: string, name: string): Promise<void>;

  /**
   * Send nurture Day 3 email (scheduled cron — ~3 days after NO decision)
   */
  sendNurtureDay3Email?(to: string, name: string): Promise<void>;

  /**
   * Send nurture Day 7 email (scheduled cron — ~7 days after NO decision, final email)
   */
  sendNurtureDay7Email?(to: string, name: string): Promise<void>;

  /**
   * Send certificate ready email after course completion (Module 5 — LMS)
   */
  sendCertificateReadyEmail?(
    to: string,
    name: string,
    courseName: string,
    certificateUrl: string,
  ): Promise<void>;

  /**
   * Send account suspension notification email (Module 7 — Admin)
   */
  sendSuspensionEmail?(
    to: string,
    name: string,
    suspendedAt: string,
  ): Promise<void>;

  /**
   * Send account reactivation notification email (Module 7 — Admin)
   */
  sendReactivationEmail?(to: string, name: string): Promise<void>;

  // ─── Module 6: Distributor subscription emails ──────

  /**
   * Send distributor subscription active email
   */
  sendSubscriptionActiveEmail?(
    to: string,
    data: {
      fullName: string;
      planName: string;
      amount: number;
      nextBillingDate: string;
      joinLink: string;
    },
  ): Promise<void>;

  /**
   * Send distributor subscription warning email (payment failed / halted)
   */
  sendSubscriptionWarningEmail?(
    to: string,
    data: {
      fullName: string;
      graceDeadline: string;
      paymentMethodUrl: string;
    },
  ): Promise<void>;

  /**
   * Send distributor subscription expired email
   */
  sendSubscriptionExpiredEmail?(
    to: string,
    data: {
      fullName: string;
      resubscribeUrl: string;
    },
  ): Promise<void>;

  /**
   * Send distributor subscription cancelled by admin email
   * Variables: fullName
   */
  sendSubscriptionCancelledByAdminEmail?(
    to: string,
    name: string,
  ): Promise<void>;

  /**
   * Send distributor subscription invoice email after successful charge
   */
  sendSubscriptionInvoiceEmail?(
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
  ): Promise<void>;

  /**
   * Send grace period reminder email (sent 3 days before graceDeadline for HALTED subs)
   */
  sendSubscriptionGraceReminderEmail?(
    to: string,
    data: {
      fullName: string;
      graceDeadline: string;
      paymentMethodUrl: string;
    },
  ): Promise<void>;

  /**
   * Send self-cancellation confirmation email
   */
  sendSubscriptionSelfCancelledEmail?(
    to: string,
    data: {
      fullName: string;
      accessUntil: string;
      planName: string;
    },
  ): Promise<void>;

  /**
   * Send subscription reactivated email (after admin reactivates user)
   */
  sendSubscriptionReactivatedEmail?(
    to: string,
    data: {
      fullName: string;
      planName: string;
      amount: number;
      nextBillingDate: string;
      joinLink: string;
    },
  ): Promise<void>;

  // ─── Plan migration emails ─────────────────────────

  /**
   * Email 1: Plan migration notice — plan being discontinued
   */
  sendSubscriptionMigrationNoticeEmail?(
    to: string,
    data: {
      fullName: string;
      currentPeriodEnd: string;
      newPlanUrl: string;
    },
  ): Promise<void>;

  /**
   * Email 2: Plan migration reminder — 3 days before billing date
   */
  sendSubscriptionMigrationReminderEmail?(
    to: string,
    data: {
      fullName: string;
      currentPeriodEnd: string;
      newPlanUrl: string;
    },
  ): Promise<void>;

  /**
   * Email 3: Plan migration ended — billing date reached, grace period started
   */
  sendSubscriptionMigrationEndedEmail?(
    to: string,
    data: {
      fullName: string;
      graceDeadline: string;
      newPlanUrl: string;
    },
  ): Promise<void>;
}

/**
 * Injection token for the email service provider.
 */
export const EMAIL_SERVICE_TOKEN = 'EMAIL_SERVICE';
