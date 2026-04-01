import { escapeHtml, renderButton, renderEmailShell, renderInfoCard } from './email-layout.js';

interface WelcomeTemplateOptions {
  logoSrc?: string;
}

function buildDashboardUrl(): string {
  const baseUrl = process.env.FRONTEND_URL ?? 'https://growithnsi.com';
  return `${baseUrl.replace(/\/$/, '')}/dashboard`;
}

export function getWelcomeEmailTemplate(name: string, options: WelcomeTemplateOptions = {}): { subject: string; html: string } {
  const safeName = escapeHtml(name);
  const dashboardUrl = buildDashboardUrl();
  const subject = 'Welcome to NSI Platform';
  const bodyHtml = `
    <div style="color:#334155;font-size:16px;line-height:28px;text-align:center;">
      Hi ${safeName},
    </div>
    <div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>
    <div style="color:#334155;font-size:15px;line-height:26px;text-align:center;max-width:520px;margin:0 auto;">
      Your account has been verified successfully. Everything is now in place for a calm, focused first session inside NSI.
    </div>

    <div style="height:24px;line-height:24px;font-size:0;">&nbsp;</div>

    <table
      role="presentation"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      border="0"
      style="width:100%;border:1px solid #E4E4E7;border-radius:28px;background-color:#F8FAFC;box-shadow:0 20px 40px rgba(12,22,18,0.05);"
    >
      <tr>
        <td style="padding:28px 24px;text-align:center;">
          <div style="color:#0F172A;font-size:22px;line-height:32px;font-weight:800;font-family:'Plus Jakarta Sans',Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            Your NSI account is live.
          </div>
          <div style="height:10px;line-height:10px;font-size:0;">&nbsp;</div>
          <div style="color:#64748B;font-size:15px;line-height:25px;max-width:470px;margin:0 auto;">
            Jump into your dashboard to manage your account, review your setup, and continue with a cleaner, more focused experience.
          </div>
          <div style="height:22px;line-height:22px;font-size:0;">&nbsp;</div>
          ${renderButton('Open dashboard', dashboardUrl)}
        </td>
      </tr>
    </table>

    <div style="height:20px;line-height:20px;font-size:0;">&nbsp;</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
      <tr>
        <td class="stack-column" valign="top" width="50%" style="width:50%;">
          ${renderInfoCard('Status', 'Email verified', 'success')}
        </td>
        <td class="stack-spacer" width="12" style="width:12px;font-size:0;line-height:0;">&nbsp;</td>
        <td class="stack-column" valign="top" width="50%" style="width:50%;">
          ${renderInfoCard('Access', 'Dashboard ready', 'primary')}
        </td>
      </tr>
    </table>

    <div style="height:20px;line-height:20px;font-size:0;">&nbsp;</div>

    <table
      role="presentation"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      border="0"
      style="width:100%;border:1px solid #e4e4e7;border-radius:20px;background-color:#ffffff;"
    >
      <tr>
        <td style="padding:18px 20px;">
          <div style="color:#0f172a;font-size:15px;line-height:24px;font-weight:600;">
            A polished start matters.
          </div>
          <div style="height:8px;line-height:8px;font-size:0;">&nbsp;</div>
          <div style="color:#64748b;font-size:14px;line-height:24px;">
            We kept your onboarding lightweight so you can get where you need to go fast. When you're ready, your dashboard is the best place to continue.
          </div>
        </td>
      </tr>
    </table>
  `.trim();

  return {
    subject,
    html: renderEmailShell({
      previewText: 'Your NSI account is verified and ready to go.',
      eyebrow: 'Account ready',
      title: 'Welcome to a more refined NSI experience.',
      intro: 'Your account is active, verified, and ready with the same clean, modern system behind every email touchpoint.',
      bodyHtml,
      footerNote: 'You received this email because your NSI account was successfully activated.',
      tone: 'success',
      logoSrc: options.logoSrc,
      heroAlign: 'center',
    }),
  };
}

export function welcomeEmailTemplate(name: string): string {
  return getWelcomeEmailTemplate(name).html;
}
