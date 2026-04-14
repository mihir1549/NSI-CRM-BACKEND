/**
 * Unified base email template system for Growith NSI.
 * ALL emails must use baseEmailTemplate() — no standalone HTML structures.
 *
 * Design tokens match frontend global.css exactly.
 * Logo loaded from public CDN: https://pub-b007a84c0cb34f74a238bacf3a70b85e.r2.dev/nsi-logo/ONLY%20NSI%20(1).png
 */

const LOGO_URL =
  'https://pub-b007a84c0cb34f74a238bacf3a70b85e.r2.dev/nsi-logo/ONLY%20NSI%20(1).png';

export interface BaseEmailOptions {
  /** Nav bar right-side badge label, e.g. "Subscription Active" */
  badgeText: string;
  /** Hex color for badge dot + text, e.g. "#0C7A4F" */
  badgeColor: string;
  /** Hex color for badge background, e.g. "#E8F7F1" */
  badgeBgColor: string;
  /** Hex color for badge border, e.g. "rgba(12,122,79,0.2)" */
  badgeBorderColor: string;

  /** Hero eyebrow label (small caps above headline) */
  eyebrow: string;
  /** Hero headline — use <br/> for line breaks */
  headline: string;
  /** Hero description text */
  description: string;

  /** Full HTML string for the white body section */
  bodyContent: string;

  /** Footer context line */
  footerText: string;

  /** Invisible preheader preview text shown in inbox */
  preheaderText: string;
}

function escHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function baseEmailTemplate(options: BaseEmailOptions): string {
  const {
    badgeText,
    badgeColor,
    badgeBgColor,
    badgeBorderColor,
    eyebrow,
    headline,
    description,
    bodyContent,
    footerText,
    preheaderText,
  } = options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${escHtml(eyebrow)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=Inter:wght@400;500;600&family=DM+Mono:wght@500&display=swap" rel="stylesheet"/>
  <style>
    /* Add @import for better compatibility in some clients */
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&family=Inter:wght@400;600&display=swap');

    /* Global Typography */
    body, p, td { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important; }
    h1, h2, .h1, .brand-text { font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important; }

    @media screen and (max-width:600px){
      .outer-pad  { padding:0!important }
      .card       { border-radius:0!important; border:none!important; box-shadow:none!important }
      .nav-pad    { padding:12px 20px!important }
      .hero-pad   { padding:36px 24px 32px!important }
      .body-pad   { padding:32px 20px 28px!important }
      .ftr-pad    { padding:24px 20px!important; border-radius:0!important }
      .h1         { font-size:26px!important; line-height:1.18!important }
      /* Navbar stacking */
      .nav-col    { display:block!important; width:100%!important; text-align:center!important }
      /* OTP digit boxes — shrink on narrow screens */
      .otp-digit-cell { padding:0 1px!important }
      .otp-digit      { width:34px!important; height:44px!important; border-radius:6px!important }
      .otp-digit td   { height:44px!important; font-size:20px!important; line-height:1!important; vertical-align:middle!important; text-align:center!important }
      .otp-separator  { padding:0 2px!important }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#334155;">

  <!-- Preheader -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;">
    ${escHtml(preheaderText)}&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;
  </div>

  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="width:100%;background-color:#f1f5f9;">
    <tr>
      <td align="center" class="outer-pad" style="padding:44px 20px;">

        <!-- Card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="card"
          style="width:100%;max-width:540px;background-color:#ffffff;border-radius:20px;overflow:hidden;
            box-shadow:0 2px 4px rgba(12,22,18,0.04),0 8px 24px rgba(12,22,18,0.07),0 24px 56px rgba(12,22,18,0.05);">

          <!-- ── NAV BAR ── -->
          <tr>
            <td class="nav-pad"
              style="padding:16px 28px;background-color:#ffffff;border-bottom:1px solid #e4e4e7;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                style="width:100%;">
                <tr>
                  <!-- Logo left -->
                  <td class="nav-col" valign="middle" style="vertical-align:middle;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0"
                      style="border-collapse:collapse;margin:0 auto;" class="nav-col">
                      <tr>
                        <!-- Logo container -->
                        <td valign="middle" style="vertical-align:middle;padding:0;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0"
                            style="border-collapse:collapse;overflow:hidden;
                              width:68px;height:68px;min-width:68px;min-height:68px;">
                            <tr>
                              <td width="68" height="68" align="center" valign="middle"
                                style="width:68px;height:68px;padding:0;text-align:center;vertical-align:middle;">
                                <img src="${LOGO_URL}" alt="NSI" width="68" height="68"
                                  style="display:block;width:68px;height:68px;border:0;outline:0;text-decoration:none;"/>
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td width="14" style="width:14px;font-size:0;line-height:0;">&nbsp;</td>
                        <td valign="middle" style="vertical-align:middle;text-align:left;">
                          <span class="brand-text" style="font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                            font-size:20px;font-weight:800;color:#0f172a;letter-spacing:-0.03em;
                            white-space:nowrap;line-height:1;">
                            Growith NSI
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── HERO GRADIENT ── -->
          <tr>
            <td class="hero-pad"
              style="padding:44px 36px 40px;background:linear-gradient(155deg,#1A4070 0%,#1568C0 60%,#1e7ad4 100%);">
              <!-- Eyebrow -->
              <div style="font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;
                color:rgba(255,255,255,0.42);margin-bottom:14px;">
                ${escHtml(eyebrow)}
              </div>
              <!-- Headline -->
              <div class="h1" style="font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
                font-size:30px;font-weight:800;line-height:1.2;color:#ffffff;
                letter-spacing:-0.03em;margin-bottom:14px;">
                ${headline}
              </div>
              <!-- Description -->
              <div style="font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                font-size:13.5px;line-height:1.6;color:rgba(255,255,255,0.58);max-width:420px;">
                ${escHtml(description)}
              </div>
            </td>
          </tr>

          <!-- ── BODY ── -->
          <tr>
            <td class="body-pad" style="padding:40px 36px 36px;background-color:#ffffff;">
              ${bodyContent}
            </td>
          </tr>

          <!-- ── FOOTER ── -->
          <tr>
            <td class="ftr-pad"
              style="padding:22px 36px;background-color:#fafafa;border-top:1px solid #e4e4e7;
                border-radius:0 0 20px 20px;">
              <div style="font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                font-size:11px;line-height:1.6;color:#94a3b8;margin-bottom:10px;">
                ${escHtml(footerText)}
              </div>
              <div style="font-size:11px;line-height:1.6;color:#94a3b8;">
                <a href="https://growithnsi.com"
                  style="color:#1568C0;text-decoration:none;font-weight:500;">growithnsi.com</a>
                <span style="margin:0 6px;color:#cbd5e1;">&middot;</span>
                <a href="mailto:noreply@growithnsi.com"
                  style="color:#94a3b8;text-decoration:none;">noreply@growithnsi.com</a>
                <span style="margin:0 6px;color:#cbd5e1;">&middot;</span>
                <a href="https://growithnsi.com/privacy"
                  style="color:#94a3b8;text-decoration:none;">Privacy</a>
                <span style="margin:0 6px;color:#cbd5e1;">&middot;</span>
                <a href="https://growithnsi.com/terms"
                  style="color:#94a3b8;text-decoration:none;">Terms</a>
                <span style="margin:0 6px;color:#cbd5e1;">&middot;</span>
                <a href="https://growithnsi.com/unsubscribe"
                  style="color:#94a3b8;text-decoration:none;">Unsubscribe</a>
              </div>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>

</body>
</html>`;
}

// ─────────────────────────────────────────────
// Reusable body helper functions
// ─────────────────────────────────────────────

/**
 * Detail card block — gray bg with key-value rows.
 * Pass `valueColor` to override the value text color (e.g. for "Total Paid" in green).
 */
export function emailDetailCard(
  label: string,
  rows: { key: string; value: string; valueColor?: string }[],
): string {
  const rowsHtml = rows
    .map(
      (row, i) => {
        const isLast = i === rows.length - 1;
        const borderStyle = isLast ? '' : 'border-bottom:1px solid #f1f5f9;';
        return `
      <tr>
        <td style="padding:11px 20px;${borderStyle}vertical-align:middle;">
          <span style="font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
            font-size:12px;font-weight:500;color:#64748b;">
            ${escHtml(row.key)}
          </span>
        </td>
        <td style="padding:11px 20px;${borderStyle}text-align:right;vertical-align:middle;">
          <span style="font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
            font-size:13px;font-weight:600;color:${row.valueColor ?? '#0f172a'};">
            ${escHtml(row.value)}
          </span>
        </td>
      </tr>`;
      },
    )
    .join('');

  return `
    <div style="margin-bottom:20px;">
      <div style="font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;
        color:#94a3b8;margin-bottom:8px;">
        ${escHtml(label)}
      </div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
        style="width:100%;border:1px solid #e4e4e7;border-radius:12px;overflow:hidden;
          background-color:#fafafa;">
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>`.trim();
}

/**
 * CTA button — centered, full pill shape.
 * Default: brand blue gradient. Pass a hex for solid-color variants.
 */
export function emailCtaButton(text: string, url: string, color?: string): string {
  const bg = color ?? 'linear-gradient(155deg,#1A4070,#1568C0)';
  // Detect if it's a gradient or a flat color
  const isGradient = bg.startsWith('linear-gradient');
  const bgStyle = isGradient
    ? `background:${bg};`
    : `background-color:${bg};`;

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;margin:24px 0 0;">
      <tr>
        <td align="center" style="text-align:center;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"
            style="margin:0 auto;">
            <tr>
              <td align="center" style="border-radius:99px;${bgStyle}padding:0;">
                <a href="${escHtml(url)}"
                  style="display:inline-block;padding:14px 32px;border-radius:99px;
                    font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                    font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;
                    letter-spacing:0.01em;mso-padding-alt:0;${bgStyle}">
                  ${escHtml(text)}
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`.trim();
}

/**
 * Callout block — left-bordered info box.
 */
export function emailCalloutBlock(
  title: string,
  body: string,
  borderColor: string,
): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;border:1px solid #e4e4e7;border-left:3px solid ${borderColor};
        border-radius:8px;background-color:#fafafa;margin:16px 0;">
      <tr>
        <td style="padding:14px 18px;">
          <div style="font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
            font-size:13px;font-weight:800;color:#0f172a;margin-bottom:6px;">
            ${escHtml(title)}
          </div>
          <div style="font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
            font-size:13px;line-height:1.6;color:#334155;">
            ${body}
          </div>
        </td>
      </tr>
    </table>`.trim();
}

/**
 * Alert block — colored bg box for deadlines / warnings.
 */
export function emailAlertBlock(
  label: string,
  value: string,
  sublabel: string,
  color: string,
  bgColor: string,
): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;background-color:${bgColor};border:1.5px solid ${color};
        border-radius:12px;margin:16px 0;">
      <tr>
        <td style="padding:20px 24px;text-align:center;">
          <div style="font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
            font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;
            color:${color};margin-bottom:8px;">
            ${escHtml(label)}
          </div>
          <div style="font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
            font-size:24px;font-weight:800;color:${color};margin-bottom:6px;">
            ${escHtml(value)}
          </div>
          <div style="font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
            font-size:12px;color:${color};opacity:0.8;">
            ${escHtml(sublabel)}
          </div>
        </td>
      </tr>
    </table>`.trim();
}

/**
 * Horizontal divider.
 */
export function emailDivider(): string {
  return `<div style="height:1px;background-color:#e4e4e7;margin:20px 0;"></div>`;
}
