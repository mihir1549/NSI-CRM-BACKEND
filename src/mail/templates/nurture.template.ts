/**
 * Nurture email template — sent when a user answers NO on the decision step.
 * Goal: encourage them to reconsider and explore further.
 */
export function getNurtureEmailTemplate(name: string): { subject: string; html: string } {
  return {
    subject: 'We understand — here is more to explore',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>We understand — here is more to explore</title>
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
              <p style="margin:8px 0 0;font-size:13px;color:#a0aec0;letter-spacing:1px;text-transform:uppercase;">Your journey continues</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:48px 48px 32px;">
              <p style="margin:0 0 20px;font-size:16px;color:#4a5568;line-height:1.6;">Hi <strong style="color:#1a202c;">${name}</strong>,</p>

              <p style="margin:0 0 20px;font-size:16px;color:#4a5568;line-height:1.6;">
                We completely understand — big decisions take time. There is no pressure here, and your account remains open whenever you are ready.
              </p>

              <p style="margin:0 0 20px;font-size:16px;color:#4a5568;line-height:1.6;">
                Many of our members felt the same way at first. They took a few days to think it over, did a little more research, and came back when it felt right. We will be here.
              </p>

              <!-- Highlight box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0;">
                <tr>
                  <td style="background-color:#f7fafc;border-left:4px solid #667eea;border-radius:4px;padding:20px 24px;">
                    <p style="margin:0;font-size:15px;color:#2d3748;line-height:1.7;">
                      💧 <strong>Did you know?</strong> Kangen Water machines pay for themselves over time by replacing bottled water costs for the whole family — typically within 2–3 years.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 32px;font-size:16px;color:#4a5568;line-height:1.6;">
                When you feel ready to explore again, your progress is saved and you can pick up exactly where you left off.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:3001'}" 
                       style="display:inline-block;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 40px;border-radius:6px;letter-spacing:0.3px;">
                      Continue Exploring →
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
                You received this email because you completed our product walkthrough.<br/>
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
