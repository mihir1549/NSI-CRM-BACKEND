import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  IStorageProvider,
  STORAGE_PROVIDER,
} from '../storage/storage-provider.interface.js';
import * as puppeteer from 'puppeteer';

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: Date;
  fullName: string;
  email: string;
  planName: string;
  amount: number; // in rupees
  currency: string;
  nextBillingDate: Date | null;
}

@Injectable()
export class InvoicePdfService {
  private readonly logger = new Logger(InvoicePdfService.name);

  constructor(
    @Inject(STORAGE_PROVIDER)
    private readonly storageProvider: IStorageProvider,
  ) {}

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
    let browser: puppeteer.Browser | null = null;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
      });
      return Buffer.from(pdf);
    } finally {
      if (browser) await browser.close();
    }
  }

  private buildInvoiceHtml(data: InvoiceData): string {
    const formattedAmount = `₹${data.amount.toLocaleString('en-IN')}`;
    const formattedDate = new Date(data.invoiceDate).toLocaleDateString(
      'en-IN',
      {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      },
    );
    const formattedNextBilling = data.nextBillingDate
      ? new Date(data.nextBillingDate).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })
      : null;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1a1a2e; background: #ffffff; }
    .invoice-wrapper { max-width: 700px; margin: 0 auto; padding: 40px; }

    /* Header */
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 48px; border-bottom: 3px solid #4f46e5; padding-bottom: 24px; }
    .brand-name { font-size: 28px; font-weight: 800; color: #4f46e5; letter-spacing: -0.5px; }
    .brand-tagline { font-size: 12px; color: #6b7280; margin-top: 4px; }
    .invoice-label { text-align: right; }
    .invoice-label h2 { font-size: 20px; font-weight: 700; color: #1a1a2e; }
    .invoice-label p { font-size: 13px; color: #6b7280; margin-top: 4px; }

    /* Bill To */
    .bill-section { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .bill-to h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 8px; }
    .bill-to p { font-size: 15px; font-weight: 600; color: #1a1a2e; }
    .bill-to span { font-size: 13px; color: #6b7280; display: block; margin-top: 2px; }

    /* Table */
    .invoice-table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
    .invoice-table thead tr { background: #4f46e5; }
    .invoice-table thead th { padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px; }
    .invoice-table tbody tr { border-bottom: 1px solid #f3f4f6; }
    .invoice-table tbody td { padding: 14px 16px; font-size: 14px; color: #374151; }
    .invoice-table tfoot tr { background: #f9fafb; }
    .invoice-table tfoot td { padding: 14px 16px; font-size: 15px; font-weight: 700; color: #1a1a2e; }

    /* Amount Box */
    .amount-box { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); border-radius: 12px; padding: 24px 32px; text-align: center; margin-bottom: 32px; }
    .amount-box .label { font-size: 12px; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 1px; }
    .amount-box .amount { font-size: 36px; font-weight: 800; color: #ffffff; margin-top: 4px; }

    /* Footer */
    .next-billing { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px 20px; margin-bottom: 32px; }
    .next-billing p { font-size: 13px; color: #166534; }
    .next-billing strong { font-weight: 700; }
    .footer-note { text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 24px; }
    .footer-note strong { color: #4f46e5; }
  </style>
</head>
<body>
  <div class="invoice-wrapper">
    <div class="header">
      <div>
        <div class="brand-name">NSI Platform</div>
        <div class="brand-tagline">growithnsi.com</div>
      </div>
      <div class="invoice-label">
        <h2>INVOICE</h2>
        <p>${data.invoiceNumber}</p>
        <p>${formattedDate}</p>
      </div>
    </div>

    <div class="bill-section">
      <div class="bill-to">
        <h3>Billed To</h3>
        <p>${data.fullName}</p>
        <span>${data.email}</span>
      </div>
      <div class="bill-to">
        <h3>Payment Status</h3>
        <p style="color: #16a34a;">&#10003; Paid</p>
        <span>${formattedDate}</span>
      </div>
    </div>

    <table class="invoice-table">
      <thead>
        <tr>
          <th>Description</th>
          <th>Period</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${data.planName} — Distributor Subscription</td>
          <td>Monthly</td>
          <td>${formattedAmount}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2">Total Paid</td>
          <td>${formattedAmount}</td>
        </tr>
      </tfoot>
    </table>

    <div class="amount-box">
      <div class="label">Amount Paid</div>
      <div class="amount">${formattedAmount}</div>
    </div>

    ${
      formattedNextBilling
        ? `
    <div class="next-billing">
      <p>&#128197; Your next billing date is <strong>${formattedNextBilling}</strong>.
      Your subscription will auto-renew for ${formattedAmount}.</p>
    </div>
    `
        : ''
    }

    <div class="footer-note">
      <p>This is an official payment receipt from <strong>NSI Platform</strong>.</p>
      <p style="margin-top: 4px;">For support, contact us at growithnsi.com</p>
    </div>
  </div>
</body>
</html>`;
  }
}
