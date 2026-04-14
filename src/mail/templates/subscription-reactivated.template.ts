import {
  baseEmailTemplate,
  emailCalloutBlock,
  emailCtaButton,
  emailDetailCard,
} from './base-email.template.js';

interface SubscriptionReactivatedData {
  fullName: string;
  planName: string;
  amount: number;
  nextBillingDate: string;
  joinLink: string;
}

export function getSubscriptionReactivatedTemplate(
  data: SubscriptionReactivatedData,
): { subject: string; html: string } {
  const frontendUrl = (process.env.FRONTEND_URL ?? 'https://growithnsi.com').replace(/\/$/, '');
  const dashboardUrl = `${frontendUrl}/distributor/dashboard`;
  const formattedAmount = `₹${data.amount.toLocaleString('en-IN')}/month`;
  const formattedNextBilling = new Date(data.nextBillingDate).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const bodyContent = `
    ${emailDetailCard('Plan Details', [
      { key: 'Plan', value: data.planName },
      { key: 'Amount', value: formattedAmount },
      { key: 'Next billing', value: formattedNextBilling },
    ])}
    ${emailCalloutBlock(
      'All systems go',
      `Your join link is reactivated and new leads will be attributed to you again.<br/><br/>Your join link:<br/><a href="${data.joinLink}" style="color:#1568C0;text-decoration:none;font-weight:600;word-break:break-all;">${data.joinLink}</a><br/><br/>Everything is exactly as you left it — your tasks, calendar notes, and campaigns are all intact.`,
      '#0C7A4F',
    )}
    ${emailCtaButton('Go to Dashboard', dashboardUrl)}
  `.trim();

  return {
    subject: 'Welcome back — your Growith NSI subscription is active again!',
    html: baseEmailTemplate({
      badgeText: 'Welcome Back',
      badgeColor: '#0C7A4F',
      badgeBgColor: '#E8F7F1',
      badgeBorderColor: 'rgba(12,122,79,0.2)',
      eyebrow: 'Reactivated',
      headline: "Welcome back!<br/>You're all set.",
      description: 'Your distributor subscription has been reactivated. Pick up right where you left off.',
      bodyContent,
      footerText: "You're receiving this because you resubscribed to a Growith NSI distributor plan.",
      preheaderText: 'Welcome back — your subscription is active again!',
    }),
  };
}
