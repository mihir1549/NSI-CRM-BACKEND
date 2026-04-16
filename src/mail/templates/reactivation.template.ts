import {
  baseEmailTemplate,
  emailCalloutBlock,
  emailCtaButton,
} from './base-email.template.js';

/**
 * Account reactivation notification email.
 * Sent when a Super Admin reactivates a previously suspended user account.
 */
export function getReactivationEmailTemplate(
  name: string,
  frontendUrl: string,
): { subject: string; html: string } {
  const loginUrl = `${frontendUrl.replace(/\/$/, '')}/login`;

  const bodyContent = `
    <div style="font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      font-size:14px;line-height:1.7;color:#334155;margin-bottom:20px;">
      Dear <strong style="color:#0f172a;">${name}</strong>, great news! Your Growith NSI account has been reactivated by our administration team.
    </div>
    ${emailCalloutBlock(
      'Account Status: Active',
      'You can now log in and access the platform as normal. All your data and settings are exactly as you left them.',
      '#0C7A4F',
    )}
    ${emailCtaButton('Login now', loginUrl)}
  `.trim();

  return {
    subject: 'Your Growith NSI Account Has Been Reactivated',
    html: baseEmailTemplate({
      badgeText: 'Account Active',
      badgeColor: '#0C7A4F',
      badgeBgColor: '#E8F7F1',
      badgeBorderColor: 'rgba(12,122,79,0.2)',
      eyebrow: 'Account notice',
      headline: 'Your account has<br/>been reactivated.',
      description: 'Great news — your Growith NSI account is active again.',
      bodyContent,
      footerText:
        "You're receiving this because an administrator reactivated your Growith NSI account.",
      preheaderText:
        'Your Growith NSI account has been reactivated — log in to continue.',
    }),
  };
}
