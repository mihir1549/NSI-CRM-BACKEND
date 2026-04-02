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
  sendOtpEmail?(to: string, otp: string, type: 'verification' | 'password-reset'): Promise<void>;

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
}

/**
 * Injection token for the email service provider.
 */
export const EMAIL_SERVICE_TOKEN = 'EMAIL_SERVICE';
