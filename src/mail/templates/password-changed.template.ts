export function getPasswordChangedEmailTemplate(name: string): { subject: string; html: string } {
  const subject = 'Your NSI Platform Password Was Changed';
  
  const now = new Date();
  const date = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; background-color: #f4f7f6; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; overflow: hidden; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
    <div style="background-color: #1B3A6B; padding: 30px; text-align: center;">
      <div style="color: #ffffff; font-size: 24px; font-weight: bold; letter-spacing: 1px;">NSI Platform</div>
    </div>
    <div style="padding: 40px 30px; text-align: center;">
      <h2 style="color: #1B3A6B; font-size: 24px; margin-top: 0;">Password Changed Successfully</h2>
      <p style="color: #666666; font-size: 16px; margin-bottom: 30px;">Hello ${name},</p>
      
      <p style="color: #666666; font-size: 14px; margin-bottom: 20px;">Your password was changed on <span style="font-weight: bold;">${date} at ${time}</span>.</p>
      
      <a href="https://growithnsi.com/login" style="display: inline-block; background-color: #2E75B6; color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 5px; font-weight: bold; font-size: 16px; margin:bottom: 30px;">Go to Login</a>
      
      <p style="color: #d9534f; font-size: 14px; font-weight: bold; margin-top: 30px;">If you did not make this change, contact us immediately.</p>
      
    </div>
    <div style="background-color: #f4f7f6; padding: 20px; text-align: center; border-top: 1px solid #e5e5e5;">
      <p style="color: #999999; font-size: 12px; margin: 0;"><a href="https://growithnsi.com" style="color: #999999; text-decoration: none;">growithnsi.com</a> | <a href="mailto:noreply@growithnsi.com" style="color: #999999; text-decoration: none;">noreply@growithnsi.com</a></p>
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html };
}
