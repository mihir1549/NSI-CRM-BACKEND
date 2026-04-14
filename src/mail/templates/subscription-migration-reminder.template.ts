import {
  baseEmailTemplate,
  emailAlertBlock,
  emailCalloutBlock,
  emailCtaButton,
} from './base-email.template.js';

interface MigrationReminderData {
  fullName: string;
  currentPeriodEnd: string;
  newPlanUrl: string;
}

export function getSubscriptionMigrationReminderTemplate(
  data: MigrationReminderData,
): { subject: string; html: string } {
  const formattedDate = new Date(data.currentPeriodEnd).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const bodyContent = `
    ${emailAlertBlock(
      'Plan ends on',
      formattedDate,
      'Only 3 days left — subscribe now to keep your access',
      '#C13333',
      '#FBEAEA',
    )}
    ${emailCalloutBlock(
      'Act now',
      `&bull; Subscribe to the new plan to keep your distributor access<br/>&bull; Your leads, join link, and dashboard will continue seamlessly<br/>&bull; If you don't subscribe by ${formattedDate}, you'll enter a 7-day grace period`,
      '#B5680A',
    )}
    ${emailCtaButton('Subscribe to new plan', data.newPlanUrl, '#C13333')}
  `.trim();

  return {
    subject: '3 Days Left on Your Growith NSI Distributor Plan',
    html: baseEmailTemplate({
      badgeText: 'Urgent Reminder',
      badgeColor: '#C13333',
      badgeBgColor: '#FBEAEA',
      badgeBorderColor: 'rgba(193,51,51,0.2)',
      eyebrow: 'Plan migration',
      headline: '3 days left<br/>on your plan.',
      description: 'Your current distributor plan is ending soon. Subscribe to the new plan to avoid any interruption.',
      bodyContent,
      footerText: "You're receiving this because your Growith NSI distributor plan is ending soon.",
      preheaderText: `Only 3 days left on your plan — subscribe now to keep your distributor access.`,
    }),
  };
}
