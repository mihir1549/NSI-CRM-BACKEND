import {
  baseEmailTemplate,
  emailCalloutBlock,
  emailCtaButton,
} from './base-email.template.js';

/**
 * Nurture Day 7 email — final email in the sequence, ~7 days after decision NO.
 * Goal: no pressure close. Door is always open. After this, lead moves to LOST.
 */
export function getNurtureDay7Template(name: string, frontendUrl: string): { subject: string; html: string } {
  const ctaUrl = `${frontendUrl}/dashboard?step=decision`;

  const bodyContent = `
    <div style="font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      font-size:14px;line-height:1.7;color:#334155;margin-bottom:20px;">
      Hi <strong style="color:#0f172a;">${name}</strong>,<br/><br/>
      This is our last note to you — we promise we will not keep filling your inbox.<br/><br/>
      We genuinely hope you found value in learning about Kangen Water. Whether you decide to join or not, we wish you well.
    </div>
    ${emailCalloutBlock(
      'No pressure. No hard sell.',
      'Your account stays open. Your progress is saved. If the timing ever feels right — even months from now — you can log back in and pick up exactly where you left off.',
      '#0C7A4F',
    )}
    <div style="font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      font-size:14px;line-height:1.7;color:#334155;margin:16px 0 12px;">
      A few things worth knowing if you ever change your mind:
    </div>
    <div style="font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      font-size:14px;line-height:2;color:#334155;margin-bottom:20px;">
      &bull; Kangen machines are used in over 6,500 hospitals in Japan<br/>
      &bull; Enagic operates in 190+ countries with 40+ years of history<br/>
      &bull; Distributors earn commissions from Day 1 — no monthly quota
    </div>
    <div style="font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      font-size:14px;line-height:1.7;color:#334155;margin-bottom:8px;">
      Whenever you feel ready, we will be here.
    </div>
    ${emailCtaButton("I'm ready now", ctaUrl)}
  `.trim();

  return {
    subject: 'Last message from us',
    html: baseEmailTemplate({
      badgeText: 'From Growith NSI',
      badgeColor: '#1568C0',
      badgeBgColor: '#E3EEFB',
      badgeBorderColor: 'rgba(21,104,192,0.2)',
      eyebrow: 'Just for you',
      headline: 'The door is<br/>always open.',
      description: 'This is our final note. Your account stays open — come back whenever it feels right.',
      bodyContent,
      footerText: "You're receiving this because you showed interest in Growith NSI.",
      preheaderText: 'Last message from us — your account stays open whenever you\'re ready.',
    }),
  };
}
