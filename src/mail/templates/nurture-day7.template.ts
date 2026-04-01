/**
 * Nurture Day 7 email — final email in the sequence, ~7 days after decision NO.
 * Goal: no pressure close. Door is always open. After this, lead moves to LOST.
 */
export function getNurtureDay7Template(name: string, frontendUrl: string): { subject: string; html: string } {
  const ctaUrl = `${frontendUrl}/dashboard?step=decision`;

  return {
    subject: 'Last message from us 🙏',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Last message from us</title>
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
              <p style="margin:8px 0 0;font-size:13px;color:#a0aec0;letter-spacing:1px;text-transform:uppercase;">The door is always open</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:48px 48px 32px;">
              <p style="margin:0 0 20px;font-size:16px;color:#4a5568;line-height:1.6;">Hi <strong style="color:#1a202c;">${name}</strong>,</p>

              <p style="margin:0 0 20px;font-size:16px;color:#4a5568;line-height:1.6;">
                This is our last note to you — we promise we will not keep filling your inbox.
              </p>

              <p style="margin:0 0 20px;font-size:16px;color:#4a5568;line-height:1.6;">
                We genuinely hope you found value in learning about Kangen Water. Whether you decide to join or not, we wish you well.
              </p>

              <!-- No-pressure box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
                <tr>
                  <td style="background-color:#f0fdf4;border-radius:8px;padding:24px 28px;text-align:center;">
                    <p style="margin:0 0 12px;font-size:22px;">🤝</p>
                    <p style="margin:0;font-size:16px;color:#166534;font-weight:600;line-height:1.6;">
                      No pressure. No hard sell.
                    </p>
                    <p style="margin:8px 0 0;font-size:14px;color:#15803d;line-height:1.7;">
                      Your account stays open. Your progress is saved. If the timing ever feels right — even months from now — you can log back in and pick up exactly where you left off.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 12px;font-size:16px;color:#4a5568;line-height:1.6;">
                A few things worth knowing if you ever change your mind:
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
                <tr>
                  <td style="padding:6px 0;font-size:15px;color:#4a5568;line-height:1.6;">💧 &nbsp;Kangen machines are used in over 6,500 hospitals in Japan</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:15px;color:#4a5568;line-height:1.6;">🌍 &nbsp;Enagic operates in 190+ countries with 40+ years of history</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:15px;color:#4a5568;line-height:1.6;">📈 &nbsp;Distributors earn commissions from Day 1 — no monthly quota</td>
                </tr>
              </table>

              <p style="margin:0 0 32px;font-size:16px;color:#4a5568;line-height:1.6;">
                Whenever you feel ready, we will be here.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${ctaUrl}"
                       style="display:inline-block;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 40px;border-radius:6px;letter-spacing:0.3px;">
                      I'm ready now →
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
                This is the last email in our sequence. We won't contact you again unless you re-engage.<br/>
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
