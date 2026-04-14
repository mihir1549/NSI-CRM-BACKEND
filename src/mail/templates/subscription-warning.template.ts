import {
  baseEmailTemplate,
  emailAlertBlock,
  emailCalloutBlock,
  emailCtaButton,
  emailDetailCard,
} from './base-email.template.js';

interface SubscriptionWarningData {
  fullName: string;
  graceDeadline: string;
  paymentMethodUrl: string;
}

export function getSubscriptionWarningTemplate(
  data: SubscriptionWarningData,
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
      'Action required by',
      formattedDeadline,
      'Your access will be suspended after this date',
      '#C13333',
      '#FBEAEA',
    )}
    ${emailDetailCard('Payment Status', [
      { key: 'Amount due', value: 'Subscription renewal', valueColor: '#C13333' },
      { key: 'Status', value: 'Payment halted' },
    ])}
    ${emailCalloutBlock(
      "What happens next?",
      'If your payment method is not updated before the deadline:<br/><br/>&bull; Your Distributor access will be removed<br/>&bull; Your active leads will be reassigned<br/>&bull; Your join link will be deactivated',
      '#B5680A',
    )}
    ${emailCtaButton('Update payment method', data.paymentMethodUrl, '#C13333')}
  `.trim();

  return {
    subject: 'Action Required — Your payment couldn\'t be processed',
    html: baseEmailTemplate({
      badgeText: 'Action Required',
      badgeColor: '#B5680A',
      badgeBgColor: '#FEF4E4',
      badgeBorderColor: 'rgba(181,104,10,0.2)',
      eyebrow: 'Payment issue',
      headline: "Your payment<br/>couldn't be processed.",
      description: 'We tried to charge your payment method but it was declined. Update your details to keep your access.',
      bodyContent,
      footerText: "You're receiving this because a payment issue was detected on your Growith NSI account.",
      preheaderText: "Action required — your payment couldn't be processed",
    }),
  };
}
