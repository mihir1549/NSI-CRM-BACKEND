import {
  baseEmailTemplate,
  emailCalloutBlock,
  emailCtaButton,
} from './base-email.template.js';

/**
 * Nurture email template — sent when a user answers NO on the decision step.
 * Goal: encourage them to reconsider and explore further.
 */
export function getNurtureEmailTemplate(name: string): {
  subject: string;
  html: string;
} {
  const frontendUrl = (
    process.env.FRONTEND_URL ?? 'https://growithnsi.com'
  ).replace(/\/$/, '');
  const ctaUrl = `${frontendUrl}/dashboard?step=decision`;

  const bodyContent = `
    <div style="font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      font-size:14px;line-height:1.7;color:#334155;margin-bottom:20px;">
      Hi <strong style="color:#0f172a;">${name}</strong>,<br/><br/>
      We completely understand — big decisions take time. There is no pressure here, and your account remains open whenever you are ready.<br/><br/>
      Many of our members felt the same way at first. They took a few days to think it over, did a little more research, and came back when it felt right. We will be here.
    </div>
    ${emailCalloutBlock(
      'Did you know?',
      'Kangen Water machines pay for themselves over time by replacing bottled water costs for the whole family — typically within 2–3 years.',
      '#1568C0',
    )}
    <div style="font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      font-size:14px;line-height:1.7;color:#334155;margin:16px 0 8px;">
      When you feel ready to explore again, your progress is saved and you can pick up exactly where you left off.
    </div>
    ${emailCtaButton('Continue Exploring', ctaUrl)}
  `.trim();

  return {
    subject: 'We understand — here is more to explore',
    html: baseEmailTemplate({
      badgeText: 'From Growith NSI',
      badgeColor: '#1568C0',
      badgeBgColor: '#E3EEFB',
      badgeBorderColor: 'rgba(21,104,192,0.2)',
      eyebrow: 'Just for you',
      headline: 'Take your time.<br/>We understand.',
      description:
        "There's no rush. Your account and progress are saved whenever you're ready to explore again.",
      bodyContent,
      footerText:
        "You're receiving this because you showed interest in Growith NSI.",
      preheaderText:
        "We understand — your account stays open whenever you're ready.",
    }),
  };
}
