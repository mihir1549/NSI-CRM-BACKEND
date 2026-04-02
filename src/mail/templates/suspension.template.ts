/**
 * Account suspension notification email.
 * Sent when a Super Admin suspends a user account.
 */
export function getSuspensionEmailTemplate(
  name: string,
  suspendedAt: string,
): { subject: string; html: string } {
  return {
    subject: 'Your NSI Platform account has been suspended',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Account Suspended</title>
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
              <p style="margin:8px 0 0;font-size:13px;color:#a0aec0;letter-spacing:1px;text-transform:uppercase;">Account Notice</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:48px 48px 32px;">
              <p style="margin:0 0 20px;font-size:16px;color:#4a5568;line-height:1.6;">Dear <strong style="color:#1a202c;">${name}</strong>,</p>

              <p style="margin:0 0 20px;font-size:16px;color:#4a5568;line-height:1.6;">
                Your account has been temporarily suspended by our administration team.
              </p>

              <!-- Status box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
                <tr>
                  <td style="background-color:#fff8f0;border-left:4px solid #ed8936;border-radius:4px;padding:18px 22px;">
                    <p style="margin:0;font-size:15px;color:#c05621;font-weight:600;">Account Status: Suspended</p>
                    <p style="margin:8px 0 0;font-size:14px;color:#7b341e;line-height:1.6;">
                      Account suspended on: <strong>${suspendedAt}</strong>
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 20px;font-size:16px;color:#4a5568;line-height:1.6;">
                If you believe this is a mistake, please contact us at
                <a href="mailto:support@growithnsi.com" style="color:#3182ce;text-decoration:none;">support@growithnsi.com</a>
                and our team will review your case.
              </p>

              <p style="margin:0;font-size:16px;color:#4a5568;line-height:1.6;">
                We appreciate your understanding.
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
