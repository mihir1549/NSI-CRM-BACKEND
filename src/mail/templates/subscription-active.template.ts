import {
  baseEmailTemplate,
  emailCalloutBlock,
  emailCtaButton,
  emailDetailCard,
} from './base-email.template.js';

interface SubscriptionActiveData {
  fullName: string;
  planName: string;
  amount: number;
  nextBillingDate: string;
  joinLink: string;
}

export function getSubscriptionActiveTemplate(data: SubscriptionActiveData): {
  subject: string;
  html: string;
} {
  const frontendUrl = (
    process.env.FRONTEND_URL ?? 'https://growithnsi.com'
  ).replace(/\/$/, '');
  const dashboardUrl = `${frontendUrl}/distributor/dashboard`;
  const formattedAmount = `₹${data.amount.toLocaleString('en-IN')}/month`;
  const formattedNextBilling = new Date(
    data.nextBillingDate,
  ).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const startedDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const bodyContent = `
    ${emailDetailCard('Plan Details', [
      { key: 'Plan', value: data.planName },
      { key: 'Amount', value: formattedAmount },
      { key: 'Started', value: startedDate },
      { key: 'Next billing', value: formattedNextBilling },
    ])}
    ${emailCalloutBlock(
      "What's next?",
      `Share your unique join link with potential customers to start growing your network. Head to your dashboard to access all distributor tools, manage leads, and track your team's progress in real time.<br/><br/>Your join link:<br/><a href="${data.joinLink}" style="color:#1568C0;text-decoration:none;font-weight:600;word-break:break-all;">${data.joinLink}</a>`,
      '#0C7A4F',
    )}
    ${emailCtaButton('Get your join link', dashboardUrl)}
  `.trim();

  return {
    subject: "You're now a Growith NSI Distributor",
    html: baseEmailTemplate({
      badgeText: 'Subscription Active',
      badgeColor: '#0C7A4F',
      badgeBgColor: '#E8F7F1',
      badgeBorderColor: 'rgba(12,122,79,0.2)',
      eyebrow: 'Welcome aboard',
      headline: "You're now a<br/>Growith NSI Distributor.",
      description:
        'Your subscription is confirmed. Start sharing your unique join link and grow your network today.',
      bodyContent,
      footerText:
        "You're receiving this because you subscribed to a Growith NSI distributor plan.",
      preheaderText: 'Your subscription is now active — welcome aboard!',
    }),
  };
}
