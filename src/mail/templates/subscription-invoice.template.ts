import {
  baseEmailTemplate,
  emailCalloutBlock,
  emailCtaButton,
  emailDetailCard,
} from './base-email.template.js';

interface SubscriptionInvoiceData {
  fullName: string;
  invoiceNumber: string;
  planName: string;
  amount: number;
  billingDate: string;
  nextBillingDate: string;
  invoiceUrl?: string | null;
}

export function getSubscriptionInvoiceTemplate(
  data: SubscriptionInvoiceData,
): { subject: string; html: string } {
  const frontendUrl = (process.env.FRONTEND_URL ?? 'https://growithnsi.com').replace(/\/$/, '');
  const dashboardUrl = `${frontendUrl}/distributor/dashboard`;
  const formattedAmount = `₹${data.amount.toLocaleString('en-IN')}`;
  const formattedBillingDate = new Date(data.billingDate).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const formattedNextBilling = new Date(data.nextBillingDate).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  // One unified detail card — invoice no., date, plan, then divider, total paid (green), next billing
  const bodyContent = `
    ${emailDetailCard('Invoice Details', [
      { key: 'Invoice no.', value: data.invoiceNumber },
      { key: 'Date', value: formattedBillingDate },
      { key: 'Plan', value: data.planName },
      { key: 'Total paid', value: formattedAmount, valueColor: '#0C7A4F' },
      { key: 'Next billing', value: formattedNextBilling },
    ])}
    ${emailCalloutBlock(
      'Payment confirmation',
      `Your payment of <strong>${formattedAmount}</strong> for the <strong>${data.planName}</strong> plan has been processed successfully. Keep this email as your official payment receipt from Growith NSI.`,
      '#1568C0',
    )}
    ${data.invoiceUrl
      ? emailCtaButton('Download invoice PDF', data.invoiceUrl)
      : emailCtaButton('View Dashboard', dashboardUrl)
    }
  `.trim();

  return {
    subject: `Payment Receipt — ${data.invoiceNumber}`,
    html: baseEmailTemplate({
      badgeText: 'Payment Receipt',
      badgeColor: '#1568C0',
      badgeBgColor: '#E3EEFB',
      badgeBorderColor: 'rgba(21,104,192,0.2)',
      eyebrow: 'Invoice',
      headline: 'Payment received.<br/>Thank you!',
      description: 'Your subscription payment has been processed successfully. Here\'s your receipt.',
      bodyContent,
      footerText: "You're receiving this because a payment was processed for your Growith NSI subscription.",
      preheaderText: `Payment received — invoice ${data.invoiceNumber}`,
    }),
  };
}
