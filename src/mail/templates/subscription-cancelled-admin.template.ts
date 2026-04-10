import { escapeHtml, renderEmailShell } from './email-layout.js';

interface SubscriptionCancelledAdminData {
  fullName: string;
}

export function getSubscriptionCancelledAdminTemplate(
  data: SubscriptionCancelledAdminData,
): { subject: string; html: string } {
  const bodyHtml = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;background-color:#fef2f2;border:1px solid #fecaca;border-radius:16px;">
      <tr>
        <td style="padding:16px 22px;">
          <div style="color:#dc2626;font-size:15px;font-weight:700;">Subscription Cancelled</div>
          <div style="height:6px;"></div>
          <div style="color:#7f1d1d;font-size:14px;line-height:22px;">
            Hi <strong>${escapeHtml(data.fullName)}</strong>, your Distributor subscription has been cancelled by the platform administrator.
          </div>
          <div style="height:6px;"></div>
          <div style="color:#991b1b;font-size:14px;font-weight:600;">Your access has been removed immediately.</div>
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
            &bull; Your role has been changed to Customer<br/>
            &bull; Your join link has been deactivated<br/>
            &bull; Your active leads have been reassigned
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
            If you believe this is an error, please contact support at
            <a href="https://growithnsi.com" style="color:#4f46e5;text-decoration:none;">growithnsi.com</a>.
          </div>
        </td>
      </tr>
    </table>
  `.trim();

  return {
    subject: 'Your NSI Distributor Subscription Has Been Cancelled',
    html: renderEmailShell({
      previewText: 'Your NSI Distributor subscription has been cancelled by the administrator.',
      eyebrow: 'Account Update',
      title: 'Subscription Cancelled',
      intro: 'Your NSI Distributor access has been removed.',
      bodyHtml,
      footerNote: 'You received this because your NSI Distributor subscription was cancelled by an administrator.',
      tone: 'primary',
    }),
  };
}
