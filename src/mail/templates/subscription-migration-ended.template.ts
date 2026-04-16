import {
  baseEmailTemplate,
  emailAlertBlock,
  emailCalloutBlock,
  emailCtaButton,
} from './base-email.template.js';

interface MigrationEndedData {
  fullName: string;
  graceDeadline: string;
  newPlanUrl: string;
}

export function getSubscriptionMigrationEndedTemplate(
  data: MigrationEndedData,
): { subject: string; html: string } {
  const formattedDeadline = new Date(data.graceDeadline).toLocaleDateString(
    'en-IN',
    {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    },
  );

  const bodyContent = `
    ${emailAlertBlock(
      'Grace period ends',
      formattedDeadline,
      'Subscribe to the new plan before this date to keep your access',
      '#C13333',
      '#FBEAEA',
    )}
    ${emailCalloutBlock(
      'You have 7 days',
      `Your access continues until <strong>${formattedDeadline}</strong>. After that, your distributor access will be revoked and your active leads will be reassigned. Subscribe to the new plan now to avoid any interruption.`,
      '#B5680A',
    )}
    ${emailCtaButton('Subscribe to new plan', data.newPlanUrl, '#C13333')}
  `.trim();

  return {
    subject:
      'Your Growith NSI Distributor Plan Has Ended — 7 Days to Resubscribe',
    html: baseEmailTemplate({
      badgeText: 'Plan Ended',
      badgeColor: '#C13333',
      badgeBgColor: '#FBEAEA',
      badgeBorderColor: 'rgba(193,51,51,0.2)',
      eyebrow: 'Plan migration',
      headline: 'Your plan<br/>has ended.',
      description:
        'Your previous distributor plan has ended. You have 7 days to subscribe to the new plan.',
      bodyContent,
      footerText:
        "You're receiving this because your Growith NSI distributor plan has ended due to a plan change.",
      preheaderText: `Your plan has ended — you have until ${formattedDeadline} to subscribe to the new plan.`,
    }),
  };
}
