import { escapeHtml, renderButton, renderEmailShell } from './email-layout.js';

interface SubscriptionReactivatedData {
  fullName: string;
  planName: string;
  amount: number;
  nextBillingDate: string;
  joinLink: string;
}

export function getSubscriptionReactivatedTemplate(
  data: SubscriptionReactivatedData,
): { subject: string; html: string } {
  const frontendUrl = (process.env.FRONTEND_URL ?? 'https://growithnsi.com').replace(/\/$/, '');
  const dashboardUrl = `${frontendUrl}/distributor/dashboard`;
  const formattedAmount = `₹${data.amount.toLocaleString('en-IN')}`;
  const formattedNextBilling = new Date(data.nextBillingDate).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const bodyHtml = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;background-color:#faf5ff;border:1px solid #e9d5ff;border-radius:16px;">
      <tr>
        <td style="padding:16px 22px;">
          <div style="color:#7c3aed;font-size:15px;font-weight:700;">&#127881; Welcome Back!</div>
          <div style="height:6px;"></div>
          <div style="color:#6d28d9;font-size:14px;line-height:22px;">
            Your Distributor access has been restored, <strong>${escapeHtml(data.fullName)}</strong>.
          </div>
        </td>
      </tr>
    </table>

    <div style="height:20px;"></div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;border:1px solid #e4e4e7;border-radius:16px;background:#ffffff;">
      <tr>
        <td style="padding:18px 22px;">
          <div style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Plan Details</div>
          <div style="height:8px;"></div>
          <div style="color:#0f172a;font-size:18px;font-weight:700;">${escapeHtml(data.planName)}</div>
          <div style="color:#7c3aed;font-size:16px;font-weight:600;margin-top:4px;">${formattedAmount}/month</div>
          <div style="height:10px;"></div>
          <div style="color:#64748b;font-size:13px;">Next billing date: <strong style="color:#0f172a;">${formattedNextBilling}</strong></div>
        </td>
      </tr>
    </table>

    <div style="height:20px;"></div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;background-color:#faf5ff;border:1px solid #ddd6fe;border-radius:16px;">
      <tr>
        <td style="padding:18px 22px;">
          <div style="color:#7c3aed;font-size:13px;font-weight:700;margin-bottom:8px;">Your Join Link — Reactivated</div>
          <div style="background:#ffffff;border:1px solid #ddd6fe;border-radius:8px;padding:10px 14px;word-break:break-all;">
            <a href="${escapeHtml(data.joinLink)}" style="color:#7c3aed;font-size:13px;text-decoration:none;font-weight:600;">${escapeHtml(data.joinLink)}</a>
          </div>
          <div style="color:#8b5cf6;font-size:12px;margin-top:8px;">New leads will be attributed to you again.</div>
        </td>
      </tr>
    </table>

    <div style="height:20px;"></div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;border:1px solid #e4e4e7;border-radius:16px;background:#ffffff;">
      <tr>
        <td style="padding:18px 22px;">
          <div style="color:#0f172a;font-size:14px;font-weight:700;margin-bottom:10px;">Everything is exactly as you left it:</div>
          <div style="color:#475569;font-size:14px;line-height:26px;">
            &bull; Your tasks and calendar are intact<br/>
            &bull; Your campaigns are active<br/>
            &bull; Your join link has been reactivated<br/>
            &bull; New leads will be attributed to you again
          </div>
        </td>
      </tr>
    </table>

    <div style="height:16px;"></div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;background-color:#fffbeb;border:1px solid #fde68a;border-radius:16px;">
      <tr>
        <td style="padding:14px 20px;">
          <div style="color:#92400e;font-size:13px;line-height:20px;">
            <strong>Note:</strong> HOT leads that were reassigned during your inactive period remain with the admin team.
          </div>
        </td>
      </tr>
    </table>

    <div style="height:24px;"></div>
    <div style="text-align:center;">
      ${renderButton('Go to Dashboard', dashboardUrl, '#7c3aed')}
    </div>
  `.trim();

  return {
    subject: 'Welcome Back to NSI Distributor 🎉',
    html: renderEmailShell({
      previewText: `Welcome back, ${data.fullName}! Your Distributor access has been restored.`,
      eyebrow: 'Access Restored',
      title: 'Welcome Back!',
      intro: `Your NSI Distributor subscription has been reactivated, ${escapeHtml(data.fullName)}.`,
      bodyHtml,
      footerNote: 'You received this because your NSI Distributor subscription was reactivated.',
      tone: 'primary',
    }),
  };
}
