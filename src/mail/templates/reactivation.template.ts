/**
 * Account reactivation notification email.
 * Sent when a Super Admin reactivates a previously suspended user account.
 */
export function getReactivationEmailTemplate(
  name: string,
  frontendUrl: string,
): { subject: string; html: string } {
  const loginUrl = `${frontendUrl}/login`;

  return {
    subject: 'Your NSI Platform account has been reactivated',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Account Reactivated</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a4070 0%,#1568c0 100%);padding:40px 48px;text-align:center;">
              <h1 style="margin:0;font-size:28px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">NSI Platform</h1>
              <p style="margin:8px 0 0;font-size:13px;color:#bee3f8;letter-spacing:1px;text-transform:uppercase;">Account Reactivated</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:48px 48px 32px;">
              <p style="margin:0 0 20px;font-size:16px;color:#4a5568;line-height:1.6;">Dear <strong style="color:#1a202c;">${name}</strong>,</p>

              <p style="margin:0 0 20px;font-size:16px;color:#4a5568;line-height:1.6;">
                Great news! Your NSI Platform account has been reactivated by our administration team.
              </p>

              <!-- Status box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
                <tr>
                  <td style="background-color:#f0fff4;border-left:4px solid #48bb78;border-radius:4px;padding:18px 22px;">
                    <p style="margin:0;font-size:15px;color:#276749;font-weight:600;">✓ Account Status: Active</p>
                    <p style="margin:8px 0 0;font-size:14px;color:#2f855a;line-height:1.6;">
                      You can now log in and access the platform as normal.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 32px;font-size:16px;color:#4a5568;line-height:1.6;">
                Click the button below to log in to your account.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${loginUrl}"
                       style="display:inline-block;background:linear-gradient(135deg,#1568c0 0%,#1a4070 100%);color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 40px;border-radius:6px;letter-spacing:0.3px;">
                      Login Now →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:32px 0 0;font-size:14px;color:#718096;line-height:1.6;text-align:center;">
                If the button above doesn't work, copy and paste this link:<br/>
                <a href="${loginUrl}" style="color:#3182ce;text-decoration:none;">${loginUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 48px 40px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:13px;color:#a0aec0;text-align:center;line-height:1.7;">
                This is an automated notice from NSI Platform.<br/>
                © ${new Date().getFullYear()} NSI Platform. All rights reserved.
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:#a0aec0;text-align:center;">
                <a href="https://growithnsi.com" style="color:#718096;text-decoration:none;">growithnsi.com</a>
                &nbsp;|&nbsp;
                <a href="mailto:support@growithnsi.com" style="color:#718096;text-decoration:none;">support@growithnsi.com</a>
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
