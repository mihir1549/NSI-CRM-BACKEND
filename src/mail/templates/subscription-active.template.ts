import { escapeHtml, renderButton, renderEmailShell } from './email-layout.js';

interface SubscriptionActiveData {
  fullName: string;
  planName: string;
  amount: number;
  nextBillingDate: string;
  joinLink: string;
}

export function getSubscriptionActiveTemplate(
  data: SubscriptionActiveData,
): { subject: string; html: string } {
  const frontendUrl = (process.env.FRONTEND_URL ?? 'https://growithnsi.com').replace(/\/$/, '');
  const dashboardUrl = `${frontendUrl}/distributor/dashboard`;
  const formattedAmount = `₹${data.amount.toLocaleString('en-IN')}`;
  const formattedNextBilling = new Date(data.nextBillingDate).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const bodyHtml = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:16px;">
      <tr>
        <td style="padding:18px 22px;">
          <div style="color:#15803d;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">
            &#10003; Subscription Active
          </div>
          <div style="height:6px;"></div>
          <div style="color:#166534;font-size:15px;line-height:24px;">
            Welcome, <strong>${escapeHtml(data.fullName)}</strong>! You're officially an NSI Distributor.
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
          <div style="color:#4f46e5;font-size:16px;font-weight:600;margin-top:4px;">${formattedAmount}/month</div>
          <div style="height:10px;"></div>
          <div style="color:#64748b;font-size:13px;">Next billing date: <strong style="color:#0f172a;">${formattedNextBilling}</strong></div>
        </td>
      </tr>
    </table>

    <div style="height:20px;"></div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;background-color:#eef2ff;border:1px solid #c7d2fe;border-radius:16px;">
      <tr>
        <td style="padding:18px 22px;">
          <div style="color:#4338ca;font-size:13px;font-weight:700;margin-bottom:8px;">Your Join Link</div>
          <div style="background:#ffffff;border:1px solid #c7d2fe;border-radius:8px;padding:10px 14px;word-break:break-all;">
            <a href="${escapeHtml(data.joinLink)}" style="color:#4f46e5;font-size:13px;text-decoration:none;font-weight:600;">${escapeHtml(data.joinLink)}</a>
          </div>
          <div style="color:#6366f1;font-size:12px;margin-top:8px;">Share this link with potential customers to track referrals.</div>
        </td>
      </tr>
    </table>

    <div style="height:20px;"></div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;border:1px solid #e4e4e7;border-radius:16px;background:#ffffff;">
      <tr>
        <td style="padding:18px 22px;">
          <div style="color:#0f172a;font-size:14px;font-weight:700;margin-bottom:10px;">Quick Start</div>
          <div style="color:#475569;font-size:14px;line-height:24px;">
            &bull; Share your join link with potential customers<br/>
            &bull; Manage your leads from the distributor dashboard<br/>
            &bull; Track your team's progress in real time
          </div>
        </td>
      </tr>
    </table>

    <div style="height:24px;"></div>
    <div style="text-align:center;">
      ${renderButton('Go to Dashboard', dashboardUrl, '#4f46e5')}
    </div>
    <div style="height:16px;"></div>
    <div style="text-align:center;color:#64748b;font-size:13px;">Questions? Visit <a href="https://growithnsi.com" style="color:#4f46e5;text-decoration:none;">growithnsi.com</a></div>
  `.trim();

  return {
    subject: "You're now an NSI Distributor 🎉",
    html: renderEmailShell({
      previewText: `You're officially an NSI Distributor, ${data.fullName}!`,
      eyebrow: 'Distributor Access',
      title: 'Subscription Active',
      intro: `Welcome aboard, ${data.fullName}! Your NSI Distributor subscription is now active.`,
      bodyHtml,
      footerNote: 'You received this because your NSI Distributor subscription was activated.',
      tone: 'success',
    }),
  };
}
