/**
 * Nurture Day 3 email — sent ~3 days after user answers NO on the decision step.
 * Goal: social proof angle — others who said YES are already building income.
 */
export function getNurtureDay3Template(name: string, frontendUrl: string): { subject: string; html: string } {
  const ctaUrl = `${frontendUrl}/dashboard?step=decision`;

  return {
    subject: 'Still thinking? Here\'s what others are saying',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Still thinking? Here's what others are saying</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);padding:40px 48px;text-align:center;">
              <h1 style="margin:0;font-size:28px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">NSI Platform</h1>
              <p style="margin:8px 0 0;font-size:13px;color:#a0aec0;letter-spacing:1px;text-transform:uppercase;">Real people. Real results.</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:48px 48px 32px;">
              <p style="margin:0 0 20px;font-size:16px;color:#4a5568;line-height:1.6;">Hi <strong style="color:#1a202c;">${name}</strong>,</p>

              <p style="margin:0 0 20px;font-size:16px;color:#4a5568;line-height:1.6;">
                Three days ago you looked at the Kangen Water opportunity and said "not right now." We respect that completely.
              </p>

              <p style="margin:0 0 24px;font-size:16px;color:#4a5568;line-height:1.6;">
                But here is what we have noticed: people who said <strong>YES</strong> around the same time you signed up are already making their first moves — booking calls, learning the product, building their network.
              </p>

              <!-- Testimonial cards -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="background-color:#fafafa;border:1px solid #e2e8f0;border-radius:8px;padding:20px 24px;">
                    <p style="margin:0 0 8px;font-size:15px;color:#2d3748;font-style:italic;line-height:1.7;">
                      "I was nervous about the investment at first. Within 3 months I had already covered my machine cost through referrals. Now my team does the talking for me."
                    </p>
                    <p style="margin:0;font-size:13px;color:#718096;font-weight:600;">— Priya M., Distributor since 2023</p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                <tr>
                  <td style="background-color:#fafafa;border:1px solid #e2e8f0;border-radius:8px;padding:20px 24px;">
                    <p style="margin:0 0 8px;font-size:15px;color:#2d3748;font-style:italic;line-height:1.7;">
                      "I kept thinking 'maybe later' for months. When I finally said yes, I wished I had done it sooner. The community alone is worth it."
                    </p>
                    <p style="margin:0;font-size:13px;color:#718096;font-weight:600;">— Rahul K., Distributor since 2024</p>
                  </td>
                </tr>
              </table>

              <!-- What you get box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
                <tr>
                  <td style="background-color:#f7f3ff;border-left:4px solid #7c3aed;border-radius:4px;padding:20px 24px;">
                    <p style="margin:0 0 12px;font-size:15px;color:#5b21b6;font-weight:600;">When you say YES, you get:</p>
                    <table cellpadding="0" cellspacing="0">
                      <tr><td style="padding:3px 0;font-size:14px;color:#4c1d95;line-height:1.6;">✅ &nbsp; Access to your distributor dashboard</td></tr>
                      <tr><td style="padding:3px 0;font-size:14px;color:#4c1d95;line-height:1.6;">✅ &nbsp; Full product training materials</td></tr>
                      <tr><td style="padding:3px 0;font-size:14px;color:#4c1d95;line-height:1.6;">✅ &nbsp; Mentorship from active distributors</td></tr>
                      <tr><td style="padding:3px 0;font-size:14px;color:#4c1d95;line-height:1.6;">✅ &nbsp; Commission on every sale from day one</td></tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 32px;font-size:16px;color:#4a5568;line-height:1.6;">
                The decision only takes a moment. Your saved progress means you can be in within minutes.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${ctaUrl}"
                       style="display:inline-block;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 40px;border-radius:6px;letter-spacing:0.3px;">
                      Make your decision →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 48px 40px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:13px;color:#a0aec0;text-align:center;line-height:1.7;">
                You received this because you explored the NSI Platform product walkthrough.<br/>
                © ${new Date().getFullYear()} NSI Platform. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  };
}
