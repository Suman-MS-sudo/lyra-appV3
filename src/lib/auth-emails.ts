/**
 * Account emails (welcome / set password, password reset, password changed).
 * Table-based layout with inline styles so it renders in Gmail, Outlook and Apple Mail.
 */

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://lyra-app.co.in').replace(/\/+$/, '');
const SUPPORT = 'sales@lyraenterprise.co.in';

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

interface Layout {
  title: string;
  /** Inbox preview line */
  preheader: string;
  heading: string;
  paragraphs: string[];
  cta?: { label: string; href: string };
  /** Small print under the button */
  note?: string;
}

function layout({ title, preheader, heading, paragraphs, cta, note }: Layout) {
  const p = (t: string) => t.startsWith("<table") ? t : `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3f3f46;">${t}</p>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light only"><title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
      <tr><td style="padding:0 4px 18px;">
        <img src="${APP_URL}/icon.png" width="36" height="36" alt="" style="vertical-align:middle;border-radius:9px;">
        <span style="vertical-align:middle;margin-left:10px;font-size:16px;font-weight:700;color:#0a0a0a;letter-spacing:-0.01em;">Lyra Enterprises</span>
      </td></tr>
      <tr><td style="background:#ffffff;border:1px solid #e4e4e7;border-radius:16px;padding:32px 28px;">
        <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:700;color:#0a0a0a;letter-spacing:-0.02em;">${heading}</h1>
        ${paragraphs.map(p).join('\n        ')}
        ${cta ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;"><tr><td style="border-radius:10px;background:#0a0a0a;">
          <a href="${cta.href}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">${esc(cta.label)}</a>
        </td></tr></table>` : ''}
        ${note ? `<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#71717a;">${note}</p>` : ''}
        ${cta ? `<p style="margin:20px 0 0;padding-top:16px;border-top:1px solid #f1f1f3;font-size:12px;line-height:1.5;color:#a1a1aa;">Button not working? Paste this link into your browser:<br><a href="${cta.href}" style="color:#52525b;word-break:break-all;">${esc(cta.href)}</a></p>` : ''}
      </td></tr>
      <tr><td style="padding:18px 4px 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">
        Lyra Enterprises · 10/21, Vasuki Street, Cholapuram, Ambattur, Chennai 600053<br>
        +91 81223 78860 · <a href="mailto:${SUPPORT}" style="color:#71717a;">${SUPPORT}</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

export interface AuthEmail { subject: string; html: string; text: string }

/** Password reset requested from the "Forgot password" page. */
export function passwordResetEmail(link: string): AuthEmail {
  return {
    subject: 'Reset your Lyra password',
    html: layout({
      title: 'Reset your password',
      preheader: 'Use this link within 1 hour to choose a new password.',
      heading: 'Reset your password',
      paragraphs: ['We received a request to reset the password for your Lyra account. Click the button below to choose a new one.'],
      cta: { label: 'Choose a new password', href: link },
      note: `This link expires in <strong>1 hour</strong> and can be used once. If you didn't ask for this, ignore this email. Your password stays the same.`,
    }),
    text: `Reset your Lyra password\n\nChoose a new password here (expires in 1 hour, single use):\n${link}\n\nIf you didn't ask for this, ignore this email. Your password stays the same.`,
  };
}

/** New account created by an admin or super customer: welcome + set password. */
export function welcomeEmail(link: string, opts: { name?: string | null; invitedBy?: string | null } = {}): AuthEmail {
  const hi = opts.name ? `Hi ${esc(opts.name)},` : 'Hi,';
  const by = opts.invitedBy ? ` by ${esc(opts.invitedBy)}` : '';
  return {
    subject: 'Welcome to Lyra: set your password',
    html: layout({
      title: 'Welcome to Lyra',
      preheader: 'Your account is ready. Set a password to sign in.',
      heading: 'Your Lyra account is ready',
      paragraphs: [
        hi,
        `An account has been created for you${by} on Lyra, where you can track your vending machines, payments and stock in real time.`,
        'Set a password to sign in for the first time.',
      ],
      cta: { label: 'Set my password', href: link },
      note: `This link expires in <strong>1 hour</strong>. If it has expired, go to <a href="${APP_URL}/forgot-password" style="color:#52525b;">${APP_URL.replace(/^https?:\/\//, '')}/forgot-password</a> and enter this email address to get a new one.`,
    }),
    text: `${opts.name ? `Hi ${opts.name},` : 'Hi,'}\n\nAn account has been created for you${opts.invitedBy ? ` by ${opts.invitedBy}` : ''} on Lyra.\n\nSet your password here (expires in 1 hour):\n${link}\n\nIf the link has expired, request a new one at ${APP_URL}/forgot-password`,
  };
}

/** Security notice after a password change. */
export function passwordChangedEmail(opts: { when: string }): AuthEmail {
  return {
    subject: 'Your Lyra password was changed',
    html: layout({
      title: 'Password changed',
      preheader: 'Your password was just changed.',
      heading: 'Your password was changed',
      paragraphs: [
        `The password for your Lyra account was changed on <strong>${esc(opts.when)}</strong>.`,
        `If this was you, there's nothing else to do.`,
        `If it wasn't you, reset your password right away and contact us at <a href="mailto:${SUPPORT}" style="color:#0a0a0a;">${SUPPORT}</a>.`,
      ],
      cta: { label: 'Reset password', href: `${APP_URL}/forgot-password` },
    }),
    text: `Your Lyra password was changed on ${opts.when}.\n\nIf this wasn't you, reset it now at ${APP_URL}/forgot-password and contact ${SUPPORT}.`,
  };
}

export interface CollectionRow {
  organization: string;
  statement: string;
  machines: number;
  coins: number;
  amount: string;
  status?: string;
  collectBy?: string;
}

function collectionTable(rows: CollectionRow[], withStatus: boolean) {
  const th = (t: string, right = false) => `<th style="padding:8px 6px;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#71717a;text-align:${right ? 'right' : 'left'};border-bottom:1px solid #e4e4e7;">${t}</th>`;
  const td = (t: string, right = false, bold = false) => `<td style="padding:8px 6px;font-size:13px;color:#27272a;text-align:${right ? 'right' : 'left'};border-bottom:1px solid #f1f1f3;${bold ? 'font-weight:700;' : ''}">${t}</td>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:4px 0 8px;">
    <tr>${th('Organization')}${th('Statement')}${th('Machines', true)}${th('Coins', true)}${th('Amount', true)}${withStatus ? th('Collect by', true) : ''}</tr>
    ${rows.map((r) => `<tr>${td(esc(r.organization))}${td(esc(r.statement))}${td(String(r.machines), true)}${td(r.coins.toLocaleString('en-IN'), true)}${td(esc(r.amount), true, true)}${withStatus ? td(esc(r.collectBy || '—'), true) : ''}</tr>`).join('')}
  </table>`;
}

/** Internal: monthly coin collection sheet for Lyra (coins are cash Lyra collects from the machines). */
export function collectionReportEmail(o: { month: string; rows: CollectionRow[]; total: string; totalCoins: number; collectBy: string }): AuthEmail {
  const due = o.rows.filter((r) => r.amount !== '₹0.00');
  return {
    subject: `Coin collection sheet — ${o.month}: ${o.total} across ${due.length} organization${due.length === 1 ? '' : 's'}`,
    html: layout({
      title: `Coin collection — ${o.month}`,
      preheader: `${o.total} in coins to collect from ${due.length} organizations.`,
      heading: `Coins to collect — ${esc(o.month)}`,
      paragraphs: [
        `Statements for <strong>${esc(o.month)}</strong> are ready. Collect the coins from these machines by <strong>${esc(o.collectBy)}</strong>, then record each collection in the admin console.`,
        due.length ? collectionTable(due, false) : '<table role="presentation"><tr><td style="font-size:14px;color:#52525b;">No coin payments were made on any machine this month.</td></tr></table>',
        `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="padding:10px 0;font-size:15px;font-weight:700;color:#0a0a0a;">Total to collect</td><td style="padding:10px 0;text-align:right;font-size:15px;font-weight:700;color:#0a0a0a;">${esc(o.total)} · ${o.totalCoins.toLocaleString('en-IN')} coins</td></tr></table>`,
      ],
      cta: { label: 'Open billing console', href: `${APP_URL}/admin/billing` },
      note: 'The full sheet is attached as CSV. Organizations with no coin payments are not listed.',
    }),
    text: `Coins to collect — ${o.month} (by ${o.collectBy})\n\n${due.map((r) => `${r.organization} · ${r.statement} · ${r.machines} machines · ${r.coins} coins · ${r.amount}`).join('\n') || 'No coin payments this month.'}\n\nTotal: ${o.total} (${o.totalCoins} coins)\n${APP_URL}/admin/billing`,
  };
}

/** Internal: statements whose coins still haven't been collected. */
export function uncollectedDigestEmail(o: { rows: CollectionRow[]; total: string }): AuthEmail {
  return {
    subject: `Uncollected coins: ${o.total} across ${o.rows.length} statement${o.rows.length === 1 ? '' : 's'}`,
    html: layout({
      title: 'Uncollected coin statements',
      preheader: `${o.total} still to collect.`,
      heading: 'Coins still to collect',
      paragraphs: [
        'These statements are past their collection date and no collection has been recorded yet.',
        collectionTable(o.rows, true),
      ],
      cta: { label: 'Record collections', href: `${APP_URL}/admin/billing?status=overdue` },
    }),
    text: `Uncollected coin statements (${o.total}):\n${o.rows.map((r) => `${r.organization} · ${r.statement} · ${r.amount} · collect by ${r.collectBy}`).join('\n')}`,
  };
}
