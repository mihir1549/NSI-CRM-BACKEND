/**
 * Nurture Day 1 email — sent ~1 day after user answers NO on the decision step.
 * Goal: warm re-engagement, remind them what they're missing.
 */
export function getNurtureDay1Template(name: string, frontendUrl: string): { subject: string; html: string } {
  const ctaUrl = `${frontendUrl}/dashboard?step=decision`;

  return {
    subject: "You're one step away — here's what you missed",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're one step away</title>
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
              <p style="margin:8px 0 0;font-size:13px;color:#a0aec0;letter-spacing:1px;text-transform:uppercase;">The opportunity is still waiting</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:48px 48px 32px;">
              <p style="margin:0 0 20px;font-size:16px;color:#4a5568;line-height:1.6;">Hi <strong style="color:#1a202c;">${name}</strong>,</p>

              <p style="margin:0 0 20px;font-size:16px;color:#4a5568;line-height:1.6;">
                Yesterday you took a look at the Kangen Water opportunity — and then stepped back. That is completely okay. Big decisions deserve careful thought.
              </p>

              <p style="margin:0 0 20px;font-size:16px;color:#4a5568;line-height:1.6;">
                We just wanted to make sure you had all the information you needed before making up your mind.
              </p>

              <!-- Highlight boxes -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
                <tr>
                  <td style="background-color:#f0f9ff;border-left:4px solid #3b82f6;border-radius:4px;padding:18px 22px;margin-bottom:12px;">
                    <p style="margin:0;font-size:15px;color:#1e40af;font-weight:600;">💧 What is Kangen Water?</p>
                    <p style="margin:8px 0 0;font-size:14px;color:#3730a3;line-height:1.6;">
                      Enagic's Kangen machines produce ionized alkaline water used by millions of families worldwide for drinking, cooking, and wellness.
                    </p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 28px;">
                <tr>
                  <td style="background-color:#f0fdf4;border-left:4px solid #22c55e;border-radius:4px;padding:18px 22px;">
                    <p style="margin:0;font-size:15px;color:#166534;font-weight:600;">💰 The business side</p>
                    <p style="margin:8px 0 0;font-size:14px;color:#15803d;line-height:1.6;">
                      Distributors earn direct sales commissions and build passive income through a team network — many work from home on their own schedule.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 32px;font-size:16px;color:#4a5568;line-height:1.6;">
                Your progress is saved. You can pick up exactly where you left off — it takes less than a minute to make your decision.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${ctaUrl}"
                       style="display:inline-block;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 40px;border-radius:6px;letter-spacing:0.3px;">
                      Continue where you left off →
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
