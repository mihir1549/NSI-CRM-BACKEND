import {
  baseEmailTemplate,
  emailCalloutBlock,
  emailCtaButton,
} from './base-email.template.js';

/**
 * Nurture Day 1 email — sent ~1 day after user answers NO on the decision step.
 * Goal: warm re-engagement, remind them what they're missing.
 */
export function getNurtureDay1Template(
  name: string,
  frontendUrl: string,
): { subject: string; html: string } {
  const ctaUrl = `${frontendUrl}/dashboard?step=decision`;

  const bodyContent = `
    <div style="font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      font-size:14px;line-height:1.7;color:#334155;margin-bottom:20px;">
      Hi <strong style="color:#0f172a;">${name}</strong>,<br/><br/>
      Yesterday you took a look at the Kangen Water opportunity — and then stepped back. That is completely okay. Big decisions deserve careful thought.<br/><br/>
      We just wanted to make sure you had all the information you needed before making up your mind.
    </div>
    ${emailCalloutBlock(
      'What is Kangen Water?',
      "Enagic's Kangen machines produce ionized alkaline water used by millions of families worldwide for drinking, cooking, and wellness.",
      '#1568C0',
    )}
    ${emailCalloutBlock(
      'The business side',
      'Distributors earn direct sales commissions and build passive income through a team network — many work from home on their own schedule.',
      '#0C7A4F',
    )}
    <div style="font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      font-size:14px;line-height:1.7;color:#334155;margin:16px 0 8px;">
      Your progress is saved. You can pick up exactly where you left off — it takes less than a minute to make your decision.
    </div>
    ${emailCtaButton('Continue where you left off', ctaUrl)}
  `.trim();

  return {
    subject: "You're one step away — here's what you missed",
    html: baseEmailTemplate({
      badgeText: 'From Growith NSI',
      badgeColor: '#1568C0',
      badgeBgColor: '#E3EEFB',
      badgeBorderColor: 'rgba(21,104,192,0.2)',
      eyebrow: 'Just for you',
      headline: 'The opportunity<br/>is still waiting.',
      description:
        "Yesterday you took a closer look and stepped back. That's okay — we're here when you're ready.",
      bodyContent,
      footerText:
        "You're receiving this because you showed interest in Growith NSI.",
      preheaderText:
        "You're one step away — your progress is saved and waiting.",
    }),
  };
}
