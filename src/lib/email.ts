import nodemailer from 'nodemailer';

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465 (SSL), false for 587 (TLS)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
  debug: true, // Enable debug output
  logger: true // Log to console
});

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content?: string | Buffer;
    path?: string;
  }>;
}

export async function sendEmail(options: EmailOptions) {
  try {
    const info = await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments,
    });

    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('Email sending failed:', error);
    return { success: false, error: error.message };
  }
}

// Template for invoice email
export function generateInvoiceEmailHTML(data: {
  invoiceNumber: string;
  organizationName: string;
  totalAmount: string;
  dueDate: string;
  invoiceUrl: string;
  paymentUrl: string;
  totalAmountPaisa?: number;
}) {
  const isZeroAmount = data.totalAmountPaisa === 0 || data.totalAmount === '₹0.00';
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${data.invoiceNumber}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0;">Lyra Enterprises</h1>
    <p style="color: #f0f0f0; margin: 10px 0 0 0;">Vending Machine Solutions</p>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none;">
    <h2 style="color: #667eea; margin-top: 0;">${isZeroAmount ? 'Monthly Statement' : 'New Invoice'}: ${data.invoiceNumber}</h2>
    
    <p>Dear ${data.organizationName},</p>
    
    ${isZeroAmount ? `
    <p>We hope this email finds you well. This is your monthly statement for the billing period.</p>
    
    <div style="background: #e8f5e9; padding: 20px; border-left: 4px solid #4caf50; margin: 20px 0; border-radius: 5px;">
      <h3 style="margin-top: 0; color: #2e7d32;">✓ No Payment Pending</h3>
      <p style="margin: 10px 0 0 0; font-size: 16px;">We're pleased to inform you that there are no pending payments for this period. No vending machine transactions were recorded during this billing cycle.</p>
    </div>
    
    <div style="background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #667eea;">Statement Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0;"><strong>Statement Number:</strong></td>
          <td style="padding: 8px 0; text-align: right;">${data.invoiceNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0;"><strong>Total Amount:</strong></td>
          <td style="padding: 8px 0; text-align: right; color: #4caf50; font-size: 18px; font-weight: bold;">${data.totalAmount}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0;"><strong>Status:</strong></td>
          <td style="padding: 8px 0; text-align: right; color: #4caf50; font-weight: bold;">No Payment Required</td>
        </tr>
      </table>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.invoiceUrl}" style="display: inline-block; background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Statement</a>
    </div>
    
    <p style="color: #666; font-size: 14px; margin-top: 30px;">Thank you for your continued partnership with Lyra Enterprises. We look forward to serving you in the coming months.</p>
    ` : `
    <p>We hope this email finds you well. A new invoice has been generated for your account.</p>
    
    <div style="background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #667eea;">Invoice Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0;"><strong>Invoice Number:</strong></td>
          <td style="padding: 8px 0; text-align: right;">${data.invoiceNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0;"><strong>Total Amount:</strong></td>
          <td style="padding: 8px 0; text-align: right; color: #667eea; font-size: 18px; font-weight: bold;">${data.totalAmount}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0;"><strong>Due Date:</strong></td>
          <td style="padding: 8px 0; text-align: right;">${data.dueDate}</td>
        </tr>
      </table>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.paymentUrl}" style="display: inline-block; background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 0 10px;">Pay Now</a>
      <a href="${data.invoiceUrl}" style="display: inline-block; background: white; color: #667eea; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; border: 2px solid #667eea; margin: 0 10px;">View Invoice</a>
    </div>
    
    <p style="color: #666; font-size: 14px; margin-top: 30px;">If you have any questions regarding this invoice, please don't hesitate to contact our billing department.</p>
    `}
    
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    
    <div style="text-align: center; color: #999; font-size: 12px;">
      <p><strong>Lyra Enterprises</strong></p>
      <p>10/21, Vasuki Street, Cholapuram<br>Ambattur, Chennai - 600053</p>
      <p>+91 81223 78860 | lyraenterprisessales@gmail.com</p>
    </div>
  </div>
</body>
</html>
  `;
}

// Template for payment confirmation email
export function generatePaymentConfirmationHTML(data: {
  invoiceNumber: string;
  organizationName: string;
  paidAmount: string;
  paymentId: string;
  paidDate: string;
  invoiceUrl: string;
}) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Received</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0;">✓ Payment Received</h1>
    <p style="color: #f0f0f0; margin: 10px 0 0 0;">Thank you for your payment!</p>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none;">
    <p>Dear ${data.organizationName},</p>
    
    <p>We have successfully received your payment for Invoice ${data.invoiceNumber}.</p>
    
    <div style="background: white; padding: 20px; border-left: 4px solid #10b981; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #10b981;">Payment Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0;"><strong>Invoice Number:</strong></td>
          <td style="padding: 8px 0; text-align: right;">${data.invoiceNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0;"><strong>Amount Paid:</strong></td>
          <td style="padding: 8px 0; text-align: right; color: #10b981; font-size: 18px; font-weight: bold;">${data.paidAmount}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0;"><strong>Payment Date:</strong></td>
          <td style="padding: 8px 0; text-align: right;">${data.paidDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0;"><strong>Payment ID:</strong></td>
          <td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 12px;">${data.paymentId}</td>
        </tr>
      </table>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.invoiceUrl}" style="display: inline-block; background: #10b981; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Invoice</a>
    </div>
    
    <p style="color: #666; font-size: 14px; margin-top: 30px;">Thank you for your business. We appreciate your prompt payment!</p>
    
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    
    <div style="text-align: center; color: #999; font-size: 12px;">
      <p><strong>Lyra Enterprises</strong></p>
      <p>10/21, Vasuki Street, Cholapuram<br>Ambattur, Chennai - 600053</p>
      <p>+91 81223 78860 | lyraenterprisessales@gmail.com</p>
    </div>
  </div>
</body>
</html>
  `;
}

// Template for payment reminder
export function generatePaymentReminderHTML(data: {
  invoiceNumber: string;
  organizationName: string;
  dueAmount: string;
  dueDate: string;
  daysOverdue?: number;
  invoiceUrl: string;
  paymentUrl: string;
}) {
  const isOverdue = data.daysOverdue && data.daysOverdue > 0;
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Reminder</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: ${isOverdue ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'}; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0;">${isOverdue ? '⚠️ Payment Overdue' : '🔔 Payment Reminder'}</h1>
    <p style="color: #f0f0f0; margin: 10px 0 0 0;">${isOverdue ? 'Immediate attention required' : 'Payment due soon'}</p>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none;">
    <p>Dear ${data.organizationName},</p>
    
    <p>${isOverdue 
      ? `This is a reminder that your invoice ${data.invoiceNumber} is now <strong>${data.daysOverdue} days overdue</strong>. Please make the payment as soon as possible to avoid any service interruption.`
      : `This is a friendly reminder that your invoice ${data.invoiceNumber} is pending payment.`
    }</p>
    
    <div style="background: white; padding: 20px; border-left: 4px solid ${isOverdue ? '#ef4444' : '#f59e0b'}; margin: 20px 0;">
      <h3 style="margin-top: 0; color: ${isOverdue ? '#ef4444' : '#f59e0b'};">Outstanding Invoice</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0;"><strong>Invoice Number:</strong></td>
          <td style="padding: 8px 0; text-align: right;">${data.invoiceNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0;"><strong>Amount Due:</strong></td>
          <td style="padding: 8px 0; text-align: right; color: ${isOverdue ? '#ef4444' : '#f59e0b'}; font-size: 18px; font-weight: bold;">${data.dueAmount}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0;"><strong>Due Date:</strong></td>
          <td style="padding: 8px 0; text-align: right;">${data.dueDate}</td>
        </tr>
        ${isOverdue ? `
        <tr>
          <td style="padding: 8px 0;"><strong>Days Overdue:</strong></td>
          <td style="padding: 8px 0; text-align: right; color: #ef4444; font-weight: bold;">${data.daysOverdue} days</td>
        </tr>
        ` : ''}
      </table>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.paymentUrl}" style="display: inline-block; background: ${isOverdue ? '#ef4444' : '#f59e0b'}; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 0 10px;">Pay Now</a>
      <a href="${data.invoiceUrl}" style="display: inline-block; background: white; color: ${isOverdue ? '#ef4444' : '#f59e0b'}; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; border: 2px solid ${isOverdue ? '#ef4444' : '#f59e0b'}; margin: 0 10px;">View Invoice</a>
    </div>
    
    <p style="color: #666; font-size: 14px; margin-top: 30px;">If you have already made the payment, please disregard this reminder. If you're facing any issues with payment, please contact our billing department immediately.</p>
    
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    
    <div style="text-align: center; color: #999; font-size: 12px;">
      <p><strong>Lyra Enterprises</strong></p>
      <p>10/21, Vasuki Street, Cholapuram<br>Ambattur, Chennai - 600053</p>
      <p>+91 81223 78860 | lyraenterprisessales@gmail.com</p>
    </div>
  </div>
</body>
</html>
  `;
}
