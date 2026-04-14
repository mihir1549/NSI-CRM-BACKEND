import {
  baseEmailTemplate,
  emailCalloutBlock,
  emailCtaButton,
  emailDetailCard,
} from './base-email.template.js';

interface SubscriptionExpiredData {
  fullName: string;
  resubscribeUrl: string;
}

export function getSubscriptionExpiredTemplate(
  data: SubscriptionExpiredData,
): { subject: string; html: string } {
  const bodyContent = `
    ${emailDetailCard('Subscription Status', [
      { key: 'Status', value: 'Expired' },
      { key: 'Role', value: 'Changed to Customer' },
    ])}
    ${emailCalloutBlock(
      'Your data is safe',
      'Your tasks, calendar notes, and history are preserved. Re-subscribe at any time to restore your full Distributor access and pick up right where you left off.',
      '#1568C0',
    )}
    ${emailCtaButton('Resubscribe now', data.resubscribeUrl)}
  `.trim();

  return {
    subject: 'Your Growith NSI Distributor access has expired',
    html: baseEmailTemplate({
      badgeText: 'Subscription Expired',
      badgeColor: '#64748b',
      badgeBgColor: '#f1f5f9',
      badgeBorderColor: 'rgba(100,116,139,0.2)',
      eyebrow: 'Subscription ended',
      headline: 'Your distributor<br/>access has expired.',
      description: 'Your grace period has ended and your subscription is no longer active.',
      bodyContent,
      footerText: "You're receiving this because your Growith NSI subscription has expired.",
      preheaderText: 'Your distributor access has expired — resubscribe to continue',
    }),
  };
}
