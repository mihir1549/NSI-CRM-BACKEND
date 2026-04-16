import {
  baseEmailTemplate,
  emailCalloutBlock,
  emailCtaButton,
} from './base-email.template.js';

/**
 * Nurture Day 3 email — sent ~3 days after user answers NO on the decision step.
 * Goal: social proof angle — others who said YES are already building income.
 */
export function getNurtureDay3Template(
  name: string,
  frontendUrl: string,
): { subject: string; html: string } {
  const ctaUrl = `${frontendUrl}/dashboard?step=decision`;

  const bodyContent = `
    <div style="font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      font-size:14px;line-height:1.7;color:#334155;margin-bottom:20px;">
      Hi <strong style="color:#0f172a;">${name}</strong>,<br/><br/>
      Three days ago you looked at the Kangen Water opportunity and said "not right now." We respect that completely.<br/><br/>
      But here is what we have noticed: people who said <strong>YES</strong> around the same time you signed up are already making their first moves — booking calls, learning the product, building their network.
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;background-color:#fafafa;border:1px solid #e4e4e7;border-radius:12px;margin-bottom:12px;">
      <tr>
        <td style="padding:18px 20px;">
          <div style="font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
            font-size:14px;font-style:italic;color:#334155;line-height:1.7;margin-bottom:10px;">
            "I was nervous about the investment at first. Within 3 months I had already covered my machine cost through referrals. Now my team does the talking for me."
          </div>
          <div style="font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
            font-size:12px;font-weight:600;color:#64748b;">
            — Priya M., Distributor since 2023
          </div>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;background-color:#fafafa;border:1px solid #e4e4e7;border-radius:12px;margin-bottom:20px;">
      <tr>
        <td style="padding:18px 20px;">
          <div style="font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
            font-size:14px;font-style:italic;color:#334155;line-height:1.7;margin-bottom:10px;">
            "I kept thinking 'maybe later' for months. When I finally said yes, I wished I had done it sooner. The community alone is worth it."
          </div>
          <div style="font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
            font-size:12px;font-weight:600;color:#64748b;">
            — Rahul K., Distributor since 2024
          </div>
        </td>
      </tr>
    </table>

    ${emailCalloutBlock(
      'When you say YES, you get:',
      '&bull; Access to your distributor dashboard<br/>&bull; Full product training materials<br/>&bull; Mentorship from active distributors<br/>&bull; Commission on every sale from day one',
      '#1568C0',
    )}
    <div style="font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      font-size:14px;line-height:1.7;color:#334155;margin:16px 0 8px;">
      The decision only takes a moment. Your saved progress means you can be in within minutes.
    </div>
    ${emailCtaButton('Make your decision', ctaUrl)}
  `.trim();

  return {
    subject: "Still thinking? Here's what others are saying",
    html: baseEmailTemplate({
      badgeText: 'From Growith NSI',
      badgeColor: '#1568C0',
      badgeBgColor: '#E3EEFB',
      badgeBorderColor: 'rgba(21,104,192,0.2)',
      eyebrow: 'Just for you',
      headline: 'Real people.<br/>Real results.',
      description:
        "Others who said YES are already growing. Here's what they have to say.",
      bodyContent,
      footerText:
        "You're receiving this because you showed interest in Growith NSI.",
      preheaderText:
        "Still thinking? Here's what others are saying about the opportunity.",
    }),
  };
}
