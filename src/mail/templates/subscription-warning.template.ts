import { escapeHtml, renderButton, renderEmailShell } from './email-layout.js';

interface SubscriptionWarningData {
  fullName: string;
  graceDeadline: string;
  paymentMethodUrl: string;
}

export function getSubscriptionWarningTemplate(
  data: SubscriptionWarningData,
): { subject: string; html: string } {
  const formattedDeadline = (() => {
    try {
      return new Date(data.graceDeadline).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'long', year: 'numeric',
      });
    } catch {
      return data.graceDeadline;
    }
  })();

  const bodyHtml = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;background-color:#fef2f2;border:1px solid #fecaca;border-radius:16px;">
      <tr>
        <td style="padding:16px 22px;">
          <div style="color:#dc2626;font-size:15px;font-weight:700;">&#9888; Payment Failed</div>
          <div style="height:6px;"></div>
          <div style="color:#7f1d1d;font-size:14px;line-height:22px;">
            Hi <strong>${escapeHtml(data.fullName)}</strong>, your subscription payment could not be processed.
          </div>
        </td>
      </tr>
    </table>

    <div style="height:20px;"></div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;background-color:#fff1f2;border:2px solid #f87171;border-radius:16px;">
      <tr>
        <td style="padding:18px 22px;text-align:center;">
          <div style="color:#dc2626;font-size:13px;font-weight:600;margin-bottom:6px;">Action Required By</div>
          <div style="color:#991b1b;font-size:20px;font-weight:800;">${escapeHtml(formattedDeadline)}</div>
          <div style="color:#dc2626;font-size:13px;margin-top:6px;">Update your payment method before this deadline to keep access.</div>
        </td>
      </tr>
    </table>

    <div style="height:24px;"></div>
    <div style="text-align:center;">
      ${renderButton('Update Payment Method', data.paymentMethodUrl, '#dc2626')}
    </div>

    <div style="height:20px;"></div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;border:1px solid #e4e4e7;border-radius:16px;background:#ffffff;">
      <tr>
        <td style="padding:18px 22px;">
          <div style="color:#0f172a;font-size:14px;font-weight:700;margin-bottom:10px;">If you don't act before the deadline:</div>
          <div style="color:#475569;font-size:14px;line-height:26px;">
            &bull; Your Distributor access will be removed<br/>
            &bull; Your active leads will be reassigned<br/>
            &bull; Your join link will be deactivated
          </div>
        </td>
      </tr>
    </table>

    <div style="height:16px;"></div>
    <div style="text-align:center;color:#dc2626;font-size:13px;font-weight:600;">
      Act now to keep your Distributor status.
    </div>
  `.trim();

  return {
    subject: '⚠️ Payment Failed — Action Required',
    html: renderEmailShell({
      previewText: `Payment failed — update your payment method by ${formattedDeadline}`,
      eyebrow: 'Payment Failed',
      title: 'Action Required',
      intro: 'Your subscription payment could not be processed. Please update your payment method.',
      bodyHtml,
      footerNote: 'You received this because your NSI Distributor payment failed.',
      tone: 'warning',
    }),
  };
}
