import { escapeHtml, renderButton, renderEmailShell } from './email-layout.js';

interface SubscriptionExpiredData {
  fullName: string;
  resubscribeUrl: string;
}

export function getSubscriptionExpiredTemplate(
  data: SubscriptionExpiredData,
): { subject: string; html: string } {
  const bodyHtml = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;">
      <tr>
        <td style="padding:16px 22px;">
          <div style="color:#475569;font-size:15px;font-weight:700;">Subscription Ended</div>
          <div style="height:6px;"></div>
          <div style="color:#64748b;font-size:14px;line-height:22px;">
            Hi <strong>${escapeHtml(data.fullName)}</strong>, your Distributor access has been removed.
          </div>
        </td>
      </tr>
    </table>

    <div style="height:20px;"></div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;border:1px solid #e4e4e7;border-radius:16px;background:#ffffff;">
      <tr>
        <td style="padding:18px 22px;">
          <div style="color:#0f172a;font-size:14px;font-weight:700;margin-bottom:10px;">What changed:</div>
          <div style="color:#475569;font-size:14px;line-height:26px;">
            &bull; Your role has changed to Customer<br/>
            &bull; Your join link has been deactivated<br/>
            &bull; Your leads have been reassigned to our team
          </div>
        </td>
      </tr>
    </table>

    <div style="height:20px;"></div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:16px;">
      <tr>
        <td style="padding:18px 22px;">
          <div style="color:#166534;font-size:14px;font-weight:700;margin-bottom:8px;">Your data is safe.</div>
          <div style="color:#15803d;font-size:14px;line-height:22px;">
            Your tasks, calendar, and history are preserved. Re-subscribe anytime to restore access.
          </div>
        </td>
      </tr>
    </table>

    <div style="height:24px;"></div>
    <div style="text-align:center;">
      ${renderButton('Re-subscribe Now', data.resubscribeUrl, '#4f46e5')}
    </div>
  `.trim();

  return {
    subject: 'Your NSI Distributor Subscription Has Ended',
    html: renderEmailShell({
      previewText: 'Your Distributor subscription has ended — re-subscribe to restore access.',
      eyebrow: 'Subscription Ended',
      title: 'Access Removed',
      intro: `Hi ${escapeHtml(data.fullName)}, your NSI Distributor subscription has expired.`,
      bodyHtml,
      footerNote: 'You received this because your NSI Distributor subscription expired.',
      tone: 'primary',
    }),
  };
}
