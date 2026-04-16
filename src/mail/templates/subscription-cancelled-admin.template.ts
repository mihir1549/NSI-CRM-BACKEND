import { baseEmailTemplate, emailCalloutBlock } from './base-email.template.js';

interface SubscriptionCancelledAdminData {
  fullName: string;
}

export function getSubscriptionCancelledAdminTemplate(
  data: SubscriptionCancelledAdminData,
): { subject: string; html: string } {
  // fullName is used by the caller; keep parameter for API compatibility
  void data;

  const bodyContent = `
    ${emailCalloutBlock(
      'Need help?',
      'An administrator has cancelled your Growith NSI distributor subscription and your access has been removed immediately.<br/><br/>If you believe this was done in error, please contact our support team at <a href="https://growithnsi.com" style="color:#1568C0;text-decoration:none;">growithnsi.com</a> or reply to this email and we\'ll look into it promptly.',
      '#B5680A',
    )}
  `.trim();

  return {
    subject: 'Your Growith NSI Distributor Subscription Has Been Cancelled',
    html: baseEmailTemplate({
      badgeText: 'Account Update',
      badgeColor: '#B5680A',
      badgeBgColor: '#FEF4E4',
      badgeBorderColor: 'rgba(181,104,10,0.2)',
      eyebrow: 'Account notification',
      headline: 'Your subscription<br/>has been cancelled.',
      description:
        'An administrator has cancelled your distributor subscription.',
      bodyContent,
      footerText:
        "You're receiving this because an administrator made changes to your Growith NSI account.",
      preheaderText:
        'Your distributor subscription has been cancelled by an administrator',
    }),
  };
}
