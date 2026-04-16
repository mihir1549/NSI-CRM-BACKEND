import {
  baseEmailTemplate,
  emailCalloutBlock,
  emailDetailCard,
} from './base-email.template.js';

interface SubscriptionSelfCancelledData {
  fullName: string;
  planName: string;
  accessUntil: string;
}

export function getSubscriptionSelfCancelledTemplate(
  data: SubscriptionSelfCancelledData,
): { subject: string; html: string } {
  const formattedAccessUntil = (() => {
    try {
      return new Date(data.accessUntil).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return data.accessUntil;
    }
  })();

  const bodyContent = `
    ${emailDetailCard('Cancellation Details', [
      { key: 'Plan', value: data.planName },
      { key: 'Access until', value: formattedAccessUntil },
    ])}
    ${emailCalloutBlock(
      'Still have access',
      `You retain full Distributor access until <strong>${formattedAccessUntil}</strong>. All your tools, leads, and join link remain active until then. After that date, your role will change to Customer and your join link will be deactivated.<br/><br/>You can re-subscribe at any time from the plans page to restore your Distributor status.`,
      '#1568C0',
    )}
  `.trim();

  return {
    subject: `Subscription Cancelled — Access Until ${formattedAccessUntil}`,
    html: baseEmailTemplate({
      badgeText: 'Subscription Cancelled',
      badgeColor: '#64748b',
      badgeBgColor: '#f1f5f9',
      badgeBorderColor: 'rgba(100,116,139,0.2)',
      eyebrow: 'Cancellation confirmed',
      headline: 'Your subscription<br/>has been cancelled.',
      description:
        'As requested, your subscription will end at the current billing period.',
      bodyContent,
      footerText:
        "You're receiving this because you cancelled your Growith NSI subscription.",
      preheaderText: `Subscription cancelled — access continues until ${formattedAccessUntil}`,
    }),
  };
}
