import { escapeHtml, renderEmailShell } from './email-layout.js';

interface SubscriptionSelfCancelledData {
  fullName: string;
  planName: string;
  accessUntil: string;
}

export function getSubscriptionSelfCancelledTemplate(
  data: SubscriptionSelfCancelledData,
): { subject: string; html: string } {
  const formattedAccessUntil = (() => {
    try {
      return new Date(data.accessUntil).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'long', year: 'numeric',
      });
    } catch {
      return data.accessUntil;
    }
  })();

  const bodyHtml = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:16px;">
      <tr>
        <td style="padding:16px 22px;">
          <div style="color:#1d4ed8;font-size:15px;font-weight:700;">&#128338; Cancellation Confirmed</div>
          <div style="height:6px;"></div>
          <div style="color:#1e40af;font-size:14px;line-height:22px;">
            Hi <strong>${escapeHtml(data.fullName)}</strong>, your subscription has been cancelled as requested.
          </div>
        </td>
      </tr>
    </table>

    <div style="height:20px;"></div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;background-color:#f0fdf4;border:2px solid #86efac;border-radius:16px;">
      <tr>
        <td style="padding:18px 22px;text-align:center;">
          <div style="color:#166534;font-size:13px;font-weight:600;margin-bottom:6px;">You have full Distributor access until</div>
          <div style="color:#15803d;font-size:22px;font-weight:800;">${escapeHtml(formattedAccessUntil)}</div>
          <div style="color:#16a34a;font-size:13px;margin-top:6px;">Plan: ${escapeHtml(data.planName)}</div>
        </td>
      </tr>
    </table>

    <div style="height:20px;"></div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;border:1px solid #e4e4e7;border-radius:16px;background:#ffffff;">
      <tr>
        <td style="padding:18px 22px;">
          <div style="color:#0f172a;font-size:14px;font-weight:700;margin-bottom:10px;">What happens after ${escapeHtml(formattedAccessUntil)}:</div>
          <div style="color:#475569;font-size:14px;line-height:26px;">
            &bull; Your role will change to Customer<br/>
            &bull; Your join link will be deactivated
          </div>
        </td>
      </tr>
    </table>

    <div style="height:20px;"></div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;">
      <tr>
        <td style="padding:16px 22px;">
          <div style="color:#64748b;font-size:13px;line-height:22px;">
            After your access ends, you can re-subscribe anytime from the plans page to restore your Distributor status.
          </div>
        </td>
      </tr>
    </table>
  `.trim();

  return {
    subject: `Subscription Cancelled — Access Until ${formattedAccessUntil}`,
    html: renderEmailShell({
      previewText: `Your subscription is cancelled — access continues until ${formattedAccessUntil}`,
      eyebrow: 'Cancellation Confirmed',
      title: 'Access Continues',
      intro: `Hi ${escapeHtml(data.fullName)}, your cancellation request has been processed.`,
      bodyHtml,
      footerNote: 'You received this because you cancelled your NSI Distributor subscription.',
      tone: 'primary',
    }),
  };
}
