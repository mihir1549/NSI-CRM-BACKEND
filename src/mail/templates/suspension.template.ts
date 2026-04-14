import {
  baseEmailTemplate,
  emailCalloutBlock,
  emailDetailCard,
} from './base-email.template.js';

/**
 * Account suspension notification email.
 * Sent when a Super Admin suspends a user account.
 */
export function getSuspensionEmailTemplate(
  name: string,
  suspendedAt: string,
): { subject: string; html: string } {
  const bodyContent = `
    <div style="font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      font-size:14px;line-height:1.7;color:#334155;margin-bottom:20px;">
      Dear <strong style="color:#0f172a;">${name}</strong>, your account has been temporarily suspended by our administration team.
    </div>
    ${emailDetailCard('Account Status', [
      { key: 'Status', value: 'Suspended', valueColor: '#B5680A' },
      { key: 'Suspended on', value: suspendedAt },
    ])}
    ${emailCalloutBlock(
      'Think this is a mistake?',
      'If you believe this suspension was made in error, please contact our support team at <a href="mailto:support@growithnsi.com" style="color:#1568C0;text-decoration:none;">support@growithnsi.com</a> and our team will review your case promptly.',
      '#B5680A',
    )}
  `.trim();

  return {
    subject: 'Your Growith NSI Account Has Been Suspended',
    html: baseEmailTemplate({
      badgeText: 'Account Suspended',
      badgeColor: '#B5680A',
      badgeBgColor: '#FEF4E4',
      badgeBorderColor: 'rgba(181,104,10,0.2)',
      eyebrow: 'Account notice',
      headline: 'Your account has<br/>been suspended.',
      description: 'Your account has been temporarily suspended by our administration team.',
      bodyContent,
      footerText: "You're receiving this because an administrator made changes to your Growith NSI account.",
      preheaderText: 'Your Growith NSI account has been suspended — contact support if you believe this is an error.',
    }),
  };
}
