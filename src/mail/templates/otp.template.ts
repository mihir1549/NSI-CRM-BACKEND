import { escapeHtml, renderEmailShell, renderInfoCard } from './email-layout.js';

interface OtpTemplateOptions {
  logoSrc?: string;
}

function buildOtpEmailTemplate(
  otp: string,
  type: 'verification' | 'password-reset',
  recipientName?: string,
  options: OtpTemplateOptions = {},
): { subject: string; html: string } {
  const isVerification = type === 'verification';
  const safeOtp = otp.replace(/\D/g, '').slice(0, 6) || otp;
  const greeting = recipientName ? `Hi ${escapeHtml(recipientName)},` : 'Hello,';
  const subject = isVerification ? 'Your NSI verification code' : 'Reset your NSI password';
  const eyebrow = isVerification ? 'Email verification' : 'Password reset';
  const title = isVerification ? 'Your secure sign-in code is ready.' : 'Your secure password reset code is ready.';
  const intro = isVerification
    ? 'Built for clarity first. The code stays front and center so the next step feels immediate, clean, and unmistakable.'
    : 'A password reset was requested for your NSI account. The code below is the only thing you need to continue securely.';
  const actionLine = isVerification
    ? 'Enter this code in the verification screen to finish setting up your account.'
    : 'Enter this code in the password reset flow to choose a new password.';
  const footerNote = isVerification
    ? 'This security email was sent because an NSI verification flow was started.'
    : 'This security email was sent because a password reset was requested for your NSI account.';
  const tone = isVerification ? 'primary' : 'warning';
  const intentValue = isVerification ? 'Verify your email' : 'Reset your password';

  const otpCells = safeOtp
    .split('')
    .map(
      (digit) => `
        <td class="otp-cell" align="center" style="width:46px;padding:0 4px;">
          <div
            class="otp-box"
            style="width:46px;height:58px;line-height:58px;border-radius:16px;border:1px solid #d7e3f4;background-color:#ffffff;color:#0f172a;font-size:28px;font-weight:800;letter-spacing:0.04em;text-align:center;font-family:'Plus Jakarta Sans',Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;box-shadow:0 8px 18px rgba(21,104,192,0.08);"
          >
            ${escapeHtml(digit)}
          </div>
        </td>
      `.trim(),
    )
    .join('');

  const bodyHtml = `
    <div style="color:#334155;font-size:16px;line-height:28px;text-align:center;">
      ${greeting}
    </div>
    <div style="height:10px;line-height:10px;font-size:0;">&nbsp;</div>
    <div style="color:#334155;font-size:15px;line-height:26px;text-align:center;max-width:520px;margin:0 auto;">
      ${actionLine}
    </div>
    <div style="height:24px;line-height:24px;font-size:0;">&nbsp;</div>

    <table
      role="presentation"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      border="0"
      style="width:100%;border:1px solid #D6E3F4;border-radius:30px;background-color:#F5F9FF;box-shadow:0 24px 44px rgba(21,104,192,0.08);"
    >
      <tr>
        <td style="padding:30px 22px 26px;text-align:center;">
          <div style="display:inline-block;padding:7px 12px;border-radius:999px;background-color:#FFFFFF;color:#1568C0;font-size:11px;line-height:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;font-family:'Plus Jakarta Sans',Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;box-shadow:0 8px 18px rgba(12,22,18,0.05);">
            ${isVerification ? 'Verification code' : 'Reset code'}
          </div>
          <div style="height:20px;line-height:20px;font-size:0;">&nbsp;</div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
            <tr>
              ${otpCells}
            </tr>
          </table>
          <div style="height:18px;line-height:18px;font-size:0;">&nbsp;</div>
          <div style="color:#0F172A;font-size:13px;line-height:22px;font-weight:600;letter-spacing:0.22em;text-transform:uppercase;">
            ${safeOtp.split('').join(' ')}
          </div>
          <div style="height:18px;line-height:18px;font-size:0;">&nbsp;</div>
          <div style="color:#64748B;font-size:14px;line-height:24px;max-width:420px;margin:0 auto;">
            Expires in <span style="color:#0F172A;font-weight:700;">10 minutes</span>. Never share this code with anyone.
          </div>
        </td>
      </tr>
    </table>

    <div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>

    <div style="text-align:center;">
      <span class="meta-chip" style="display:inline-block;margin:0 5px 0 5px;padding:10px 14px;border-radius:999px;background-color:#F8F8FA;border:1px solid #E4E4E7;color:#334155;font-size:13px;line-height:13px;font-weight:600;">
        ${intentValue}
      </span>
      <span class="meta-chip" style="display:inline-block;margin:0 5px 0 5px;padding:10px 14px;border-radius:999px;background-color:#F8F8FA;border:1px solid #E4E4E7;color:#334155;font-size:13px;line-height:13px;font-weight:600;">
        10 minute window
      </span>
      <span class="meta-chip" style="display:inline-block;margin:0 5px 0 5px;padding:10px 14px;border-radius:999px;background-color:#F8F8FA;border:1px solid #E4E4E7;color:#334155;font-size:13px;line-height:13px;font-weight:600;">
        One-time use
      </span>
    </div>

    <div style="height:18px;line-height:18px;font-size:0;">&nbsp;</div>

    <table
      role="presentation"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      border="0"
      style="width:100%;border:1px solid #E4E4E7;border-radius:22px;background-color:#FFFFFF;"
    >
      <tr>
        <td style="padding:18px 20px 17px;">
          <div style="color:#0F172A;font-size:15px;line-height:24px;font-weight:700;font-family:'Plus Jakarta Sans',Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            Didn't request this?
          </div>
          <div style="height:8px;line-height:8px;font-size:0;">&nbsp;</div>
          <div style="color:#64748B;font-size:14px;line-height:24px;">
            You can safely ignore this message if this activity was not initiated by you. Your existing credentials stay unchanged until this code is used.
          </div>
        </td>
      </tr>
    </table>
  `.trim();

  return {
    subject,
    html: renderEmailShell({
      previewText: `${safeOtp} is your NSI security code.`,
      eyebrow,
      title,
      intro,
      bodyHtml,
      footerNote,
      tone,
      logoSrc: options.logoSrc,
      heroAlign: 'center',
    }),
  };
}

export function getOtpEmailTemplate(
  otp: string,
  type: 'verification' | 'password-reset',
  options?: OtpTemplateOptions,
): { subject: string; html: string } {
  return buildOtpEmailTemplate(otp, type, undefined, options);
}

export function otpEmailTemplate(name: string, otp: string): string {
  return buildOtpEmailTemplate(otp, 'verification', name).html;
}
