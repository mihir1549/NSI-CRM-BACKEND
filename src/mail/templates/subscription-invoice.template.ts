import { escapeHtml, renderButton, renderEmailShell } from './email-layout.js';

interface SubscriptionInvoiceData {
  fullName: string;
  invoiceNumber: string;
  planName: string;
  amount: number;
  billingDate: string;
  nextBillingDate: string;
  invoiceUrl?: string | null;
}

export function getSubscriptionInvoiceTemplate(
  data: SubscriptionInvoiceData,
): { subject: string; html: string } {
  const frontendUrl = (process.env.FRONTEND_URL ?? 'https://growithnsi.com').replace(/\/$/, '');
  const dashboardUrl = `${frontendUrl}/distributor/dashboard`;
  const formattedAmount = `₹${data.amount.toLocaleString('en-IN')}`;
  const formattedBillingDate = new Date(data.billingDate).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const formattedNextBilling = new Date(data.nextBillingDate).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const bodyHtml = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:16px;">
      <tr>
        <td style="padding:16px 22px;">
          <div style="color:#15803d;font-size:15px;font-weight:700;">
            &#10003; Payment Confirmed
          </div>
          <div style="color:#166534;font-size:13px;margin-top:4px;">Invoice ${escapeHtml(data.invoiceNumber)}</div>
        </td>
      </tr>
    </table>

    <div style="height:20px;"></div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;border-collapse:collapse;border:1px solid #e4e4e7;border-radius:16px;overflow:hidden;">
      <thead>
        <tr style="background-color:#4f46e5;">
          <th style="padding:12px 16px;text-align:left;color:#ffffff;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Description</th>
          <th style="padding:12px 16px;text-align:right;color:#ffffff;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr style="background:#ffffff;">
          <td style="padding:14px 16px;color:#374151;font-size:14px;border-bottom:1px solid #f3f4f6;">
            ${escapeHtml(data.planName)} — Monthly Subscription
          </td>
          <td style="padding:14px 16px;color:#374151;font-size:14px;text-align:right;border-bottom:1px solid #f3f4f6;">
            ${formattedAmount}
          </td>
        </tr>
        <tr style="background:#f9fafb;">
          <td style="padding:14px 16px;color:#0f172a;font-size:15px;font-weight:700;">Total Paid</td>
          <td style="padding:14px 16px;color:#0f172a;font-size:15px;font-weight:700;text-align:right;">${formattedAmount}</td>
        </tr>
      </tbody>
    </table>

    <div style="height:16px;"></div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;border:1px solid #e4e4e7;border-radius:16px;background:#ffffff;">
      <tr>
        <td style="padding:16px 22px;">
          <div style="color:#64748b;font-size:13px;">Billing Date: <strong style="color:#0f172a;">${formattedBillingDate}</strong></div>
          <div style="height:6px;"></div>
          <div style="color:#64748b;font-size:13px;">Next Billing Date: <strong style="color:#0f172a;">${formattedNextBilling}</strong></div>
        </td>
      </tr>
    </table>

    ${data.invoiceUrl ? `
    <div style="height:16px;"></div>
    <div style="text-align:center;">
      ${renderButton(`Download Invoice PDF`, data.invoiceUrl, '#0c7a4f')}
    </div>
    ` : ''}

    <div style="height:20px;"></div>
    <div style="text-align:center;color:#64748b;font-size:13px;line-height:20px;">
      This is your official payment receipt from <strong>NSI Platform</strong>.
    </div>
    <div style="height:20px;"></div>
    <div style="text-align:center;">
      ${renderButton('View Dashboard', dashboardUrl, '#4f46e5')}
    </div>
  `.trim();

  return {
    subject: `Payment Receipt — ${data.invoiceNumber} — NSI Platform`,
    html: renderEmailShell({
      previewText: `Payment receipt ${data.invoiceNumber} for ${data.planName}`,
      eyebrow: 'Payment Receipt',
      title: 'Payment Confirmed',
      intro: `Hi ${escapeHtml(data.fullName)}, your payment has been processed successfully.`,
      bodyHtml,
      footerNote: 'Keep this email as your payment receipt.',
      tone: 'success',
    }),
  };
}
