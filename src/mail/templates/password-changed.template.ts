import {
  baseEmailTemplate,
  emailCalloutBlock,
  emailCtaButton,
  emailDetailCard,
} from './base-email.template.js';

export function getPasswordChangedEmailTemplate(name: string): { subject: string; html: string } {
  const frontendUrl = (process.env.FRONTEND_URL ?? 'https://growithnsi.com').replace(/\/$/, '');
  const loginUrl = `${frontendUrl}/login`;

  const now = new Date();
  const changedAt = now.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
  }) + ' at ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const bodyContent = `
    <div style="font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      font-size:14px;line-height:1.7;color:#334155;margin-bottom:20px;">
      Hi <strong style="color:#0f172a;">${name}</strong>, your password has been changed successfully.
    </div>
    ${emailDetailCard('Change details', [
      { key: 'Changed on', value: changedAt },
    ])}
    ${emailCtaButton('Go to login', loginUrl)}
    ${emailCalloutBlock(
      "Didn't make this change?",
      'If you did not change your password, please contact us immediately at <a href="mailto:support@growithnsi.com" style="color:#C13333;text-decoration:none;">support@growithnsi.com</a> — your account may be compromised.',
      '#C13333',
    )}
  `.trim();

  return {
    subject: 'Your Growith NSI Password Was Changed',
    html: baseEmailTemplate({
      badgeText: 'Security Notice',
      badgeColor: '#1568C0',
      badgeBgColor: '#E3EEFB',
      badgeBorderColor: 'rgba(21,104,192,0.2)',
      eyebrow: 'Account security',
      headline: 'Password changed<br/>successfully.',
      description: 'Your Growith NSI account password has been updated.',
      bodyContent,
      footerText: "You're receiving this because a password change was made on your Growith NSI account.",
      preheaderText: 'Your Growith NSI password has been changed successfully.',
    }),
  };
}
