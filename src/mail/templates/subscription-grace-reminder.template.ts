import {
  baseEmailTemplate,
  emailAlertBlock,
  emailCalloutBlock,
  emailCtaButton,
} from './base-email.template.js';

interface SubscriptionGraceReminderData {
  fullName: string;
  graceDeadline: string;
  paymentMethodUrl: string;
}

export function getSubscriptionGraceReminderTemplate(
  data: SubscriptionGraceReminderData,
): { subject: string; html: string } {
  const formattedDeadline = (() => {
    try {
      return new Date(data.graceDeadline).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'long', year: 'numeric',
      });
    } catch {
      return data.graceDeadline;
    }
  })();

  const bodyContent = `
    ${emailAlertBlock(
      'Access suspended after',
      formattedDeadline,
      'This is your final reminder — act now to keep your access',
      '#C13333',
      '#FBEAEA',
    )}
    ${emailCalloutBlock(
      "Don't lose your progress",
      'Your tasks, calendar, leads, and team history are all still intact. Update your payment method now to keep everything exactly as it is.<br/><br/>&bull; Your Distributor access will be removed<br/>&bull; Your active leads will be reassigned<br/>&bull; Your join link will be deactivated',
      '#C13333',
    )}
    ${emailCtaButton('Update payment method', data.paymentMethodUrl, '#C13333')}
  `.trim();

  return {
    subject: 'Final Reminder — Your access expires in 3 days',
    html: baseEmailTemplate({
      badgeText: 'Urgent Reminder',
      badgeColor: '#C13333',
      badgeBgColor: '#FBEAEA',
      badgeBorderColor: 'rgba(193,51,51,0.2)',
      eyebrow: 'Final reminder',
      headline: 'Your access expires<br/>in 3 days.',
      description: 'This is your final reminder. Update your payment method before your grace period ends.',
      bodyContent,
      footerText: "You're receiving this because your payment grace period is ending soon.",
      preheaderText: 'Final reminder — your access expires in 3 days',
    }),
  };
}
