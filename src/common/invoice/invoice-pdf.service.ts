import { Injectable, Inject, Logger, OnModuleDestroy } from '@nestjs/common';
import {
  IStorageProvider,
  STORAGE_PROVIDER,
} from '../storage/storage-provider.interface.js';
import * as puppeteer from 'puppeteer';

const NSI_LOGO_BASE64 = 'data:image/png;base64,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';
export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: Date;
  fullName: string;
  email: string;
  planName: string;
  amount: number; // in rupees
  currency: string;
  nextBillingDate: Date | null;
  accountLabel?: string; // e.g. 'Distributor Account', 'Customer Account', 'Student Account'
}

@Injectable()
export class InvoicePdfService implements OnModuleDestroy {
  private readonly logger = new Logger(InvoicePdfService.name);
  private browser: puppeteer.Browser | null = null;

  constructor(
    @Inject(STORAGE_PROVIDER)
    private readonly storageProvider: IStorageProvider,
  ) {}

  async onModuleDestroy(): Promise<void> {
    if (this.browser) await this.browser.close();
  }

  private async getBrowser(): Promise<puppeteer.Browser> {
    if (!this.browser || !this.browser.connected) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
    return this.browser;
  }

  async generateAndUpload(data: InvoiceData): Promise<string | null> {
    try {
      const html = this.buildInvoiceHtml(data);
      const buffer = await this.generatePdfBuffer(html);
      const uploaded = await this.storageProvider.uploadPdf(
        buffer,
        'nsi-invoices',
        data.invoiceNumber,
      );
      this.logger.log(`Invoice PDF generated: ${uploaded.url}`);
      return uploaded.url;
    } catch (error) {
      this.logger.error(
        `Invoice PDF generation failed: ${(error as Error).message}`,
      );
      // Never throw — return null so email still sends without PDF
      return null;
    }
  }

  private async generatePdfBuffer(html: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: false,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });
      return Buffer.from(pdf);
    } finally {
      await page.close();
    }
  }

  private buildInvoiceHtml(data: InvoiceData): string {
    const fmtDate = (d: Date): string =>
      d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

    const fmtAmount = (n: number): string =>
      `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const formattedIssueDate = fmtDate(data.invoiceDate);
    const formattedAmount = fmtAmount(data.amount);

    const periodSubtitleHtml = data.nextBillingDate
      ? `<div class="row-period">Next billing: ${fmtDate(data.nextBillingDate)}</div>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>growithnsi Invoice</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{
  background:#f0f0f0;
  display:flex;justify-content:center;align-items:flex-start;
  min-height:100vh;padding:40px 20px;
  font-family:'Inter',system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;
  color:#1a1a1a;
}
.invoice{width:794px;background:#ffffff;box-shadow:0 1px 3px rgba(0,0,0,0.08),0 8px 24px rgba(0,0,0,0.06);}
.inv-top{padding:48px 56px 40px;display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #e8e8e8;}
.logo-area{display:flex;align-items:center;gap:12px}
.logo-name{font-size:18px;font-weight:700;color:#1a1a1a;letter-spacing:-0.3px}
.inv-title-block{text-align:right}
.inv-word{font-size:32px;font-weight:700;color:#1a1a1a;letter-spacing:-0.5px;line-height:1}
.inv-meta{margin-top:10px;display:flex;flex-direction:column;gap:3px}
.inv-meta-row{display:flex;justify-content:flex-end;gap:16px;font-size:12px;font-weight:400;color:#666}
.inv-meta-row strong{font-weight:600;color:#1a1a1a}
.addr-row{display:flex;gap:0;padding:40px 56px;border-bottom:1px solid #e8e8e8;}
.addr-block{flex:1}
.addr-label{font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#999;margin-bottom:10px}
.addr-name{font-size:14px;font-weight:600;color:#1a1a1a;margin-bottom:4px}
.addr-detail{font-size:13px;font-weight:400;color:#555;line-height:1.7}
.addr-divider{width:1px;background:#e8e8e8;margin:0 48px;flex-shrink:0}
.status-callout{margin:0 56px;padding:16px 20px;background:#f8fffe;border:1px solid #d1fae5;border-radius:6px;display:flex;align-items:center;gap:12px;}
.status-dot{width:10px;height:10px;border-radius:50%;background:#10b981;flex-shrink:0;}
.status-text{font-size:14px;font-weight:600;color:#065f46}
.status-sub{font-size:12px;color:#6b7280;margin-left:auto}
.amount-header{padding:32px 56px 24px;border-bottom:1px solid #e8e8e8;}
.amount-due-label{font-size:28px;font-weight:700;color:#1a1a1a;letter-spacing:-0.5px}
.amount-due-date{font-size:14px;font-weight:400;color:#666;margin-top:4px}
.table-wrap{padding:0 56px}
.table-head{display:grid;grid-template-columns:1fr 80px 100px 100px;padding:10px 0;border-bottom:1px solid #1a1a1a;font-size:12px;font-weight:600;color:#1a1a1a;letter-spacing:0.2px;}
.table-head div:not(:first-child){text-align:right}
.table-row{display:grid;grid-template-columns:1fr 80px 100px 100px;padding:18px 0;border-bottom:1px solid #e8e8e8;align-items:start;}
.table-row div:not(:first-child){text-align:right}
.row-title{font-size:13px;font-weight:500;color:#1a1a1a;line-height:1.3}
.row-period{font-size:12px;font-weight:400;color:#888;margin-top:2px}
.row-qty{font-size:13px;font-weight:400;color:#555}
.row-unit{font-size:13px;font-weight:400;color:#555;font-variant-numeric:tabular-nums}
.row-amt{font-size:13px;font-weight:500;color:#1a1a1a;font-variant-numeric:tabular-nums}
.totals-wrap{display:flex;justify-content:flex-end;padding:0 56px 0;}
.totals-inner{width:280px}
.total-line{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #e8e8e8;font-size:13px;}
.total-line .tl-label{font-weight:400;color:#555}
.total-line .tl-val{font-weight:400;color:#555;font-variant-numeric:tabular-nums}
.total-line.final{border-bottom:none;border-top:1px solid #1a1a1a;margin-top:2px;padding-top:12px;}
.total-line.final .tl-label{font-weight:700;color:#1a1a1a;font-size:14px}
.total-line.final .tl-val{font-weight:700;color:#1a1a1a;font-size:14px}
.inv-footer{padding:36px 56px 44px;border-top:1px solid #e8e8e8;margin-top:32px;display:flex;justify-content:space-between;align-items:flex-end;}
.footer-left{display:flex;flex-direction:column;gap:5px}
.footer-brand-name{font-size:13px;font-weight:600;color:#555}
.footer-note{font-size:11px;font-weight:400;color:#aaa;line-height:1.6;max-width:300px}
.footer-right{text-align:right;display:flex;flex-direction:column;gap:3px}
.footer-detail{font-size:11px;font-weight:400;color:#aaa}
.footer-pg{font-size:11px;font-weight:400;color:#aaa}
</style>
</head>
<body>
<div class="invoice">

  <div class="inv-top">
    <div class="logo-area">
      <img class="logo-img" src="${NSI_LOGO_BASE64}" alt="growithnsi" style="width:40px;height:40px;object-fit:contain;">
      <div class="logo-name">growithnsi</div>
    </div>
    <div class="inv-title-block">
      <div class="inv-word">Invoice</div>
      <div class="inv-meta">
        <div class="inv-meta-row"><span>Invoice number</span><strong>${data.invoiceNumber}</strong></div>
        <div class="inv-meta-row"><span>Date of issue</span><strong>${formattedIssueDate}</strong></div>
        <div class="inv-meta-row"><span>Date due</span><strong>${formattedIssueDate}</strong></div>
      </div>
    </div>
  </div>

  <div class="addr-row">
    <div class="addr-block">
      <div class="addr-label">From</div>
      <div class="addr-name">growithnsi</div>
      <div class="addr-detail">
        Network Success Institute<br>
        support@growithnsi.com<br>
        growithnsi.com
      </div>
    </div>
    <div class="addr-divider"></div>
    <div class="addr-block">
      <div class="addr-label">Bill to</div>
      <div class="addr-name">${data.fullName}</div>
      <div class="addr-detail">
        ${data.email}<br>
        ${data.accountLabel ?? 'Customer Account'}<br>
        growithnsi.com
      </div>
    </div>
  </div>

  <div class="amount-header" style="padding-top:32px">
    <div class="amount-due-label">${formattedAmount} paid on ${formattedIssueDate}</div>
    <div class="amount-due-date">Payment confirmed via Razorpay</div>
  </div>

  <div style="padding:20px 56px">
    <div class="status-callout">
      <div class="status-dot"></div>
      <div class="status-text">Payment Successful</div>
      <div class="status-sub">Razorpay · ${formattedIssueDate}</div>
    </div>
  </div>

  <div class="table-wrap" style="padding-top:8px">
    <div class="table-head">
      <div>Description</div>
      <div>Qty</div>
      <div>Unit price</div>
      <div>Amount</div>
    </div>
    <div class="table-row">
      <div>
        <div class="row-title">${data.planName}</div>
        ${periodSubtitleHtml}
      </div>
      <div class="row-qty">1</div>
      <div class="row-unit">${formattedAmount}</div>
      <div class="row-amt">${formattedAmount}</div>
    </div>
  </div>

  <div class="totals-wrap" style="padding-top:8px">
    <div class="totals-inner">
      <div class="total-line">
        <span class="tl-label">Subtotal</span>
        <span class="tl-val">${formattedAmount}</span>
      </div>
      <div class="total-line">
        <span class="tl-label">GST (0%)</span>
        <span class="tl-val">₹0.00</span>
      </div>
      <div class="total-line final">
        <span class="tl-label">Amount paid</span>
        <span class="tl-val">${formattedAmount}</span>
      </div>
    </div>
  </div>

  <div class="inv-footer">
    <div class="footer-left">
      <img src="${NSI_LOGO_BASE64}" alt="" style="width:20px;height:20px;object-fit:contain;opacity:0.6;">
      <div class="footer-brand-name">growithnsi</div>
      <div class="footer-note">
        This is an official payment receipt from growithnsi.<br>
        For support, contact us at growithnsi.com
      </div>
    </div>
    <div class="footer-right">
      <div class="footer-detail">Secured payment via Razorpay</div>
      <div class="footer-detail">growithnsi.com</div>
      <div class="footer-pg">Page 1 of 1</div>
    </div>
  </div>

</div>
</body>
</html>`;
  }
}
