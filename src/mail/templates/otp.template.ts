import {
  baseEmailTemplate,
  emailCalloutBlock,
  emailDivider,
} from './base-email.template.js';

interface OtpTemplateOptions {
  logoSrc?: string;
}

function buildOtpDigitBoxes(otp: string): string {
  const digits = otp.replace(/\D/g, '').slice(0, 6) || otp;
  
  const cells = digits
    .split('')
    .map((digit, i) => {
      const digitCell = `
        <td align="center" valign="middle" class="otp-digit-cell" style="padding:0 3px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="otp-digit"
            style="width:46px;height:58px;background:#ffffff;border:1.5px solid #e4e4e7;
              border-radius:10px;box-shadow:0 1px 3px rgba(12,22,18,0.06);border-collapse:separate;">
            <tr>
              <td align="center" valign="middle"
                style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;
                  font-size:26px;font-weight:600;color:#0f172a;text-align:center;vertical-align:middle;
                  padding:0;height:58px;line-height:1;">
                ${digit}
              </td>
            </tr>
          </table>
        </td>`.trim();

      if (i === 2) {
        return `
          ${digitCell}
          <td align="center" valign="middle" class="otp-separator" style="padding:0 4px;">
            <div style="width:6px;height:6px;border-radius:50%;background:#d1d5db;font-size:0;line-height:0;">&nbsp;</div>
          </td>`.trim();
      }
      return digitCell;
    })
    .join('');

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"
      style="margin:0 auto;border-collapse:collapse;">
      <tr>
        ${cells}
      </tr>
    </table>`.trim();
}

function buildOtpEmailTemplate(
  otp: string,
  type: 'verification' | 'password-reset',
  recipientName?: string,
  _options: OtpTemplateOptions = {},
): { subject: string; html: string } {
  const isVerification = type === 'verification';
  const safeOtp = otp.replace(/\D/g, '').slice(0, 6) || otp;

  const subject = isVerification
    ? 'Your Growith NSI verification code'
    : 'Reset your Growith NSI password';

  const eyebrow = isVerification ? 'Security Notice' : 'Password Reset';
  const headline = isVerification
    ? 'Your secure<br/>verification code.'
    : 'Reset your<br/>password.';
  const description = isVerification
    ? 'Enter the 6-digit code below to verify your email address and complete your registration.'
    : 'Enter the 6-digit code below to reset your password.';

  const actionText = isVerification
    ? `Hi${recipientName ? ` ${recipientName}` : ''}, enter this code in the verification screen to finish setting up your account.`
    : `Hi${recipientName ? ` ${recipientName}` : ''}, enter this code in the password reset flow to choose a new password.`;

  const otpBlock = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;background-color:#fafafa;border:1.5px solid #e4e4e7;border-radius:16px;">
      <tr>
        <td style="padding:28px 20px 24px;text-align:center;">
          <div style="font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
            font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;
            color:#94a3b8;margin-bottom:18px;">
            One-Time Code
          </div>
          <!-- Digit boxes — inline-block, centered via text-align:center on wrapper -->
          ${buildOtpDigitBoxes(safeOtp)}
          <!-- Expiry pill -->
          <div style="margin-top:20px;">
            <span style="display:inline-block;padding:6px 14px;border-radius:99px;
              background-color:#FEF4E4;border:1px solid rgba(181,104,10,0.25);
              font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
              font-size:12px;font-weight:600;color:#B5680A;">
              Expires in 10 minutes
            </span>
          </div>
          <div style="font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
            font-size:12px;color:#94a3b8;margin-top:10px;">
            Never share this code with anyone.
          </div>
        </td>
      </tr>
    </table>`.trim();

  const bodyContent = `
    <div style="font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      font-size:14px;line-height:1.7;color:#334155;margin-bottom:20px;">
      ${actionText}
    </div>
    ${otpBlock}
    ${emailDivider()}
    ${emailCalloutBlock(
      "Didn't request this?",
      `You can safely ignore this message if this activity was not initiated by you. Your existing credentials stay unchanged until this code is used.`,
      '#B5680A',
    )}
  `.trim();

  return {
    subject,
    html: baseEmailTemplate({
      badgeText: isVerification ? 'Email Verification' : 'Password Reset',
      badgeColor: isVerification ? '#1568C0' : '#B5680A',
      badgeBgColor: isVerification ? '#E3EEFB' : '#FEF4E4',
      badgeBorderColor: isVerification
        ? 'rgba(21,104,192,0.2)'
        : 'rgba(181,104,10,0.2)',
      eyebrow,
      headline,
      description,
      bodyContent,
      footerText: isVerification
        ? 'This security email was sent because a verification flow was started on Growith NSI Platform.'
        : 'This security email was sent because a password reset was requested for your Growith NSI account.',
      preheaderText: `Your Growith NSI ${isVerification ? 'verification' : 'password reset'} code is ${safeOtp} — expires in 10 minutes.`,
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
