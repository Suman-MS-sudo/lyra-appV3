import nodemailer from 'nodemailer';

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: process.env.SMTP_SECURE !== 'false', // port 465 = SSL (true by default)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD,
  },
  // No debug/logger: they print full messages (including reset links) into server logs
});

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: string | string[];
  attachments?: Array<{
    filename: string;
    content?: string | Buffer;
    path?: string;
  }>;
  /**
   * The email carries a one-time sign-in / set-password link. The notification
   * address then gets a separate copy with the link removed instead of a CC,
   * so that inbox never holds working account-takeover links.
   */
  sensitive?: boolean;
}

const FROM = () => `"${process.env.SMTP_FROM_NAME || 'Lyra Enterprises'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`;
const list = (v?: string | string[]) => (Array.isArray(v) ? v : (v || '').split(',')).map((s) => s.trim()).filter(Boolean);

/** Addresses copied on every email the app sends (NOTIFICATION_CC_EMAIL, comma-separated). */
function notificationCc(exclude: string[]) {
  const skip = new Set(exclude.map((e) => e.toLowerCase()));
  return list(process.env.NOTIFICATION_CC_EMAIL).filter((e) => !skip.has(e.toLowerCase()));
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/** Link-free record of a sensitive email for the notification inbox. */
async function sendRedactedCopy(options: EmailOptions, to: string[], cc: string[]) {
  const when = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) + ' IST';
  const lines = [
    `"${options.subject}" was sent to ${to.join(', ')} on ${when}.`,
    'The one-time link in it is left out of this copy for security.',
  ];
  try {
    await transporter.sendMail({
      from: FROM(),
      to: cc.join(', '),
      subject: `[Copy] ${options.subject} → ${to.join(', ')}`,
      text: lines.join('\n'),
      html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:14px;line-height:1.6;color:#27272a;">${lines.map((l) => `<p style="margin:0 0 8px;">${esc(l)}</p>`).join('')}</div>`,
    });
  } catch (error) {
    console.error('Notification copy failed:', error);
  }
}

export async function sendEmail(options: EmailOptions) {
  const to = list(options.to);
  const notify = notificationCc([...to, ...list(options.cc)]);
  const cc = [...list(options.cc), ...(options.sensitive ? [] : notify)];
  try {
    const info = await transporter.sendMail({
      from: FROM(),
      to: to.join(', '),
      cc: cc.length ? cc.join(', ') : undefined,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments,
    });

    console.log('Email sent:', info.messageId);
    if (options.sensitive && notify.length) await sendRedactedCopy(options, to, notify);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('Email sending failed:', error);
    return { success: false, error: error.message };
  }
}
