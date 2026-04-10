import { escapeHtml, renderButton, renderEmailShell } from './email-layout.js';

interface SubscriptionGraceReminderData {
  fullName: string;
  graceDeadline: string;
  paymentMethodUrl: string;
}

export function getSubscriptionGraceReminderTemplate(
  data: SubscriptionGraceReminderData,
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
      style="width:100%;background-color:#fff7ed;border:1px solid #fed7aa;border-radius:16px;">
      <tr>
        <td style="padding:16px 22px;">
          <div style="color:#ea580c;font-size:15px;font-weight:700;">&#9201; Final Reminder</div>
          <div style="height:6px;"></div>
          <div style="color:#7c2d12;font-size:14px;line-height:22px;">
            Hi <strong>${escapeHtml(data.fullName)}</strong>, your Distributor access expires in <strong>3 days</strong>.
          </div>
        </td>
      </tr>
    </table>

    <div style="height:20px;"></div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;background-color:#fff7ed;border:2px solid #fb923c;border-radius:16px;">
      <tr>
        <td style="padding:18px 22px;text-align:center;">
          <div style="color:#ea580c;font-size:13px;font-weight:600;margin-bottom:6px;">Access Expires</div>
          <div style="color:#7c2d12;font-size:24px;font-weight:800;">${escapeHtml(formattedDeadline)}</div>
          <div style="color:#ea580c;font-size:13px;margin-top:6px;">This is your final reminder — act now to keep your access.</div>
        </td>
      </tr>
    </table>

    <div style="height:24px;"></div>
    <div style="text-align:center;">
      ${renderButton('Fix Payment Now', data.paymentMethodUrl, '#ea580c')}
    </div>

    <div style="height:20px;"></div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;border:1px solid #e4e4e7;border-radius:16px;background:#ffffff;">
      <tr>
        <td style="padding:18px 22px;">
          <div style="color:#0f172a;font-size:14px;font-weight:700;margin-bottom:10px;">What happens if not fixed:</div>
          <div style="color:#475569;font-size:14px;line-height:26px;">
            &bull; Your Distributor access will be removed<br/>
            &bull; Your active leads will be reassigned<br/>
            &bull; Your join link will be deactivated
          </div>
        </td>
      </tr>
    </table>

    <div style="height:16px;"></div>
    <div style="text-align:center;color:#ea580c;font-size:13px;font-weight:600;">
      This is your final reminder before access is removed.
    </div>
  `.trim();

  return {
    subject: '⏰ 3 Days Left — Save Your NSI Distributor Access',
    html: renderEmailShell({
      previewText: `Final reminder — your access expires ${formattedDeadline}`,
      eyebrow: 'Final Reminder',
      title: '3 Days Left',
      intro: 'Your Distributor access is about to expire. Fix your payment now to keep access.',
      bodyHtml,
      footerNote: 'You received this because your NSI Distributor payment is overdue.',
      tone: 'warning',
    }),
  };
}
