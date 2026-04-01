import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

type ToneName = 'primary' | 'success' | 'warning';

interface EmailTone {
  accent: string;
  accentSoft: string;
  badgeText: string;
  panelTint: string;
}

interface EmailShellOptions {
  previewText: string;
  eyebrow: string;
  title: string;
  intro: string;
  bodyHtml: string;
  footerNote: string;
  tone?: ToneName;
  logoSrc?: string;
  heroAlign?: 'left' | 'center';
}

const tones: Record<ToneName, EmailTone> = {
  primary: {
    accent: '#1568C0',
    accentSoft: '#E3EEFB',
    badgeText: '#1568C0',
    panelTint: '#F4F8FE',
  },
  success: {
    accent: '#0C7A4F',
    accentSoft: '#E8F7F1',
    badgeText: '#0C7A4F',
    panelTint: '#F4FBF8',
  },
  warning: {
    accent: '#B5680A',
    accentSoft: '#FEF4E4',
    badgeText: '#B5680A',
    panelTint: '#FFFAF2',
  },
};

const design = {
  background: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceHover: '#F8F8FA',
  border: '#E4E4E7',
  primary: '#1568C0',
  primarySoft: '#E3EEFB',
  secondary: '#1A4070',
  textPrimary: '#0F172A',
  textSecondary: '#334155',
  textMuted: '#64748B',
  textDisabled: '#94A3B8',
  shadowLg: '0 16px 44px rgba(12, 22, 18, 0.10)',
  shadowMd: '0 8px 24px rgba(12, 22, 18, 0.07)',
};

function loadInlineLogoBase64(): string {
  const candidates = [
    resolve(process.cwd(), 'dist', 'assets', 'ONLY NSI.png'),
    resolve(process.cwd(), 'dist', 'src', 'assets', 'ONLY NSI.png'),
    resolve(process.cwd(), 'src', 'assets', 'ONLY NSI.png'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return readFileSync(candidate).toString('base64');
    }
  }

  return '';
}

const inlineLogoBase64 = loadInlineLogoBase64();

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderBrandLockup(logoSrc?: string): string {
  const resolvedLogoSrc = logoSrc ?? (inlineLogoBase64 ? `data:image/png;base64,${inlineLogoBase64}` : '');

  if (!resolvedLogoSrc) {
    return `
      <div style="display:inline-block;">
        <div style="width:92px;height:92px;border-radius:999px;background-color:rgba(255,255,255,0.18);padding:9px;margin:0 auto;">
          <div style="width:74px;height:74px;border-radius:999px;background-color:#ffffff;display:flex;align-items:center;justify-content:center;border:1px solid rgba(15,23,42,0.05);">
            <span style="display:block;color:#1A4070;font-size:16px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;font-family:'Plus Jakarta Sans',Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
              NSI
            </span>
          </div>
        </div>
      </div>
    `.trim();
  }

  return `
    <div style="display:inline-block;">
      <div style="width:92px;height:92px;border-radius:999px;background-color:rgba(255,255,255,0.18);padding:9px;margin:0 auto;">
        <div style="width:74px;height:74px;border-radius:999px;background-color:#ffffff;border:1px solid rgba(15,23,42,0.05);display:flex;align-items:center;justify-content:center;">
          <img
            src="${resolvedLogoSrc}"
            alt="NSI"
            width="42"
            style="display:block;width:42px;max-width:42px;height:auto;border:0;outline:none;text-decoration:none;"
          />
        </div>
      </div>
    </div>
  `.trim();
}

export function renderButton(label: string, href: string, backgroundColor = '#1568C0'): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td
          align="center"
          bgcolor="${backgroundColor}"
          style="border-radius:999px;background-color:${backgroundColor};box-shadow:0 12px 28px rgba(21,104,192,0.22);"
        >
          <a
            href="${href}"
            style="display:inline-block;padding:14px 24px;font-size:15px;line-height:15px;font-weight:700;color:#ffffff;text-decoration:none;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"
          >
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>
  `.trim();
}

export function renderInfoCard(label: string, value: string, tone: ToneName = 'primary'): string {
  const currentTone = tones[tone];

  return `
    <table
      role="presentation"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      border="0"
      style="width:100%;border:1px solid ${design.border};border-radius:20px;background-color:${design.surface};"
    >
      <tr>
        <td style="padding:18px 18px 16px;text-align:left;">
          <div
            style="display:inline-block;padding:6px 10px;border-radius:999px;background-color:${currentTone.accentSoft};color:${currentTone.badgeText};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;font-family:'Plus Jakarta Sans',Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"
          >
            ${escapeHtml(label)}
          </div>
          <div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>
          <div style="color:${design.textPrimary};font-size:18px;line-height:26px;font-weight:700;font-family:'Plus Jakarta Sans',Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            ${escapeHtml(value)}
          </div>
        </td>
      </tr>
    </table>
  `.trim();
}

export function renderEmailShell({
  previewText,
  eyebrow,
  title,
  intro,
  bodyHtml,
  footerNote,
  tone = 'primary',
  logoSrc,
  heroAlign = 'left',
}: EmailShellOptions): string {
  const currentTone = tones[tone];
  const isCenteredHero = heroAlign === 'center';
  const heroTextAlign = isCenteredHero ? 'center' : 'left';
  const heroIntroMaxWidth = isCenteredHero ? '540px' : '500px';
  const heroIntroMargin = isCenteredHero ? '0 auto' : '0';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet" />
  <style>
    @media only screen and (max-width: 620px) {
      .email-shell {
        width: 100% !important;
      }

      .shell-hero,
      .shell-body {
        padding-left: 24px !important;
        padding-right: 24px !important;
      }

      .shell-hero {
        padding-top: 26px !important;
        padding-bottom: 24px !important;
      }

      .shell-body {
        padding-top: 26px !important;
        padding-bottom: 26px !important;
      }

      .hero-title {
        font-size: 30px !important;
        line-height: 36px !important;
      }

      .brand-avatar {
        width: 84px !important;
        height: 84px !important;
      }

      .stack-column,
      .stack-spacer {
        display: block !important;
        width: 100% !important;
      }

      .stack-spacer {
        height: 14px !important;
        line-height: 14px !important;
      }

      .otp-cell {
        width: 42px !important;
      }

      .otp-box {
        width: 42px !important;
        height: 56px !important;
        line-height: 56px !important;
        font-size: 26px !important;
      }

      .otp-spacing {
        padding-left: 2px !important;
        padding-right: 2px !important;
      }

      .meta-chip {
        display: block !important;
        width: 100% !important;
        margin-bottom: 10px !important;
      }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${design.background};font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${design.textSecondary};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;">
    ${escapeHtml(previewText)}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:${design.background};">
    <tr>
      <td align="center" style="padding:24px 12px 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-shell" style="width:100%;max-width:640px;margin:0 auto;">
          <tr>
            <td>
              <table
                role="presentation"
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="width:100%;background-color:${design.surface};border:1px solid ${design.border};border-radius:32px;overflow:hidden;box-shadow:${design.shadowLg};"
              >
                <tr>
                  <td class="shell-hero" style="padding:30px 32px 26px;background-color:${design.secondary};">
                    <div style="text-align:${heroTextAlign};">
                      <div class="brand-avatar" style="display:inline-block;">
                        ${renderBrandLockup(logoSrc)}
                      </div>
                    </div>
                    <div style="height:20px;line-height:20px;font-size:0;">&nbsp;</div>
                    <div style="text-align:${heroTextAlign};">
                      <div
                        style="display:inline-block;padding:8px 12px;border-radius:999px;background-color:rgba(255,255,255,0.12);color:#dbe7f7;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;font-family:'Plus Jakarta Sans',Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"
                      >
                        ${escapeHtml(eyebrow)}
                      </div>
                    </div>
                    <div style="height:20px;line-height:20px;font-size:0;">&nbsp;</div>
                    <div class="hero-title" style="margin:0;color:#ffffff;font-size:38px;line-height:44px;font-weight:800;letter-spacing:-0.04em;text-align:${heroTextAlign};font-family:'Plus Jakarta Sans',Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                      ${escapeHtml(title)}
                    </div>
                    <div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>
                    <div style="max-width:${heroIntroMaxWidth};margin:${heroIntroMargin};color:#d6e1ee;font-size:15px;line-height:24px;text-align:${heroTextAlign};">
                      ${escapeHtml(intro)}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="shell-body" style="padding:34px 32px 32px;">
                    ${bodyHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:16px 8px 0;">
              <div style="color:${design.textMuted};font-size:13px;line-height:20px;">
                ${escapeHtml(footerNote)}
              </div>
              <div style="height:8px;line-height:8px;font-size:0;">&nbsp;</div>
              <div style="color:${design.textDisabled};font-size:12px;line-height:20px;">
                <a href="https://growithnsi.com" style="color:${design.textMuted};text-decoration:none;">growithnsi.com</a>
                <span style="padding:0 8px;color:#CBD5E1;">|</span>
                <a href="mailto:noreply@growithnsi.com" style="color:${design.textMuted};text-decoration:none;">noreply@growithnsi.com</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
