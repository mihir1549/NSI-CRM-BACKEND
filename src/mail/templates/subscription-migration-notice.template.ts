import {
  baseEmailTemplate,
  emailCalloutBlock,
  emailCtaButton,
  emailDetailCard,
} from './base-email.template.js';

interface MigrationNoticeData {
  fullName: string;
  currentPeriodEnd: string;
  newPlanUrl: string;
}

export function getSubscriptionMigrationNoticeTemplate(
  data: MigrationNoticeData,
): { subject: string; html: string } {
  const formattedDate = new Date(data.currentPeriodEnd).toLocaleDateString(
    'en-IN',
    {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    },
  );

  const bodyContent = `
    ${emailDetailCard('Plan Update', [
      { key: 'Current access ends', value: formattedDate },
      { key: 'Action required', value: 'Subscribe to new plan' },
    ])}
    ${emailCalloutBlock(
      'What this means',
      `Your access continues uninterrupted until <strong>${formattedDate}</strong>. After that date, your subscription will end automatically. To continue as a distributor, subscribe to the new plan before then — your leads, join link, and dashboard will carry over seamlessly.`,
      '#B5680A',
    )}
    ${emailCtaButton('View new plan', data.newPlanUrl)}
  `.trim();

  return {
    subject: 'Your Growith NSI Distributor Plan Is Changing',
    html: baseEmailTemplate({
      badgeText: 'Plan Update',
      badgeColor: '#B5680A',
      badgeBgColor: '#FEF4E4',
      badgeBorderColor: 'rgba(181,104,10,0.2)',
      eyebrow: 'Plan migration',
      headline: 'Your plan is<br/>being updated.',
      description:
        "We're upgrading our distributor plans. Here's what you need to know and what action to take.",
      bodyContent,
      footerText:
        "You're receiving this because your current Growith NSI distributor plan is being discontinued.",
      preheaderText: `Your distributor plan is being discontinued — subscribe to the new plan before ${formattedDate}.`,
    }),
  };
}
