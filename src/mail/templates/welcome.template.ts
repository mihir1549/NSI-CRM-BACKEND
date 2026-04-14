import {
  baseEmailTemplate,
  emailCalloutBlock,
  emailCtaButton,
} from './base-email.template.js';

interface WelcomeTemplateOptions {
  logoSrc?: string;
}

export function getWelcomeEmailTemplate(name: string, _options: WelcomeTemplateOptions = {}): { subject: string; html: string } {
  const frontendUrl = (process.env.FRONTEND_URL ?? 'https://growithnsi.com').replace(/\/$/, '');
  const dashboardUrl = `${frontendUrl}/dashboard`;

  const bodyContent = `
    <div style="font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      font-size:14px;line-height:1.7;color:#334155;margin-bottom:20px;">
      Hi <strong style="color:#0f172a;">${name}</strong>,<br/><br/>
      Your account has been verified successfully. Everything is now in place for a calm, focused first session inside Growith NSI.
    </div>
    ${emailCalloutBlock(
      'Your account is live',
      'Jump into your dashboard to manage your account, review your setup, and continue with a cleaner, more focused experience.',
      '#0C7A4F',
    )}
    ${emailCtaButton('Open dashboard', dashboardUrl)}
  `.trim();

  return {
    subject: 'Welcome to Growith NSI',
    html: baseEmailTemplate({
      badgeText: 'Account Verified',
      badgeColor: '#0C7A4F',
      badgeBgColor: '#E8F7F1',
      badgeBorderColor: 'rgba(12,122,79,0.2)',
      eyebrow: 'Account ready',
      headline: 'Welcome to<br/>Growith NSI.',
      description: 'Your account is active, verified, and ready. A polished start awaits you inside.',
      bodyContent,
      footerText: "You're receiving this because your Growith NSI account was successfully activated.",
      preheaderText: 'Your Growith NSI account is verified and ready to go.',
    }),
  };
}

export function welcomeEmailTemplate(name: string): string {
  return getWelcomeEmailTemplate(name).html;
}
