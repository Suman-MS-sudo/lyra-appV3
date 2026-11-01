/**
 * Coin collection engine (server only; service-role client, callers do the auth).
 *
 * Coins dropped into a machine are cash that Lyra staff physically collect, so
 * organizations are never billed. Each month every organization gets a coin
 * collection *statement* (stored in organization_invoices) recording the coins
 * in its machines; Lyra receives the collection sheet, and an admin marks each
 * statement collected (recording the counted cash) after the visit.
 *
 * Months are IST calendar months. Generation is idempotent: an organization
 * never gets two live statements for the same month, so re-running is safe.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';
import { collectionReportEmail, uncollectedDigestEmail, type CollectionRow } from '@/lib/auth-emails';
import { IST_OFFSET_MS } from '@/lib/time';

/** Days after the statement date by which coins should be collected (BILLING_COLLECTION_DAYS, default 15). */
export const COLLECTION_WINDOW_DAYS = Number(process.env.BILLING_COLLECTION_DAYS) || 15;
/** Days at the start of a month on which the automatic run may (re)try last month's statements. */
const GENERATION_WINDOW_DAYS = 3;

export function billingDb(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Where Lyra's collection sheets go: BILLING_REPORT_EMAIL → NOTIFICATION_CC_EMAIL → the sending address. */
export function billingReportRecipients(): string[] {
  const raw = process.env.BILLING_REPORT_EMAIL || process.env.NOTIFICATION_CC_EMAIL || process.env.SMTP_FROM_EMAIL || '';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

/** IST calendar month as UTC instants: offset 0 = this month, -1 = last month. */
export function istMonth(offset = 0, now = Date.now()) {
  const ist = new Date(now + IST_OFFSET_MS);
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth() + offset;
  return {
    start: new Date(Date.UTC(y, m, 1) - IST_OFFSET_MS),
    end: new Date(Date.UTC(y, m + 1, 1) - IST_OFFSET_MS),
    label: new Date(Date.UTC(y, m, 1)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
  };
}

export const istDayOfMonth = (now = Date.now()) => new Date(now + IST_OFFSET_MS).getUTCDate();
const istWeekday = (now = Date.now()) => new Date(now + IST_OFFSET_MS).getUTCDay(); // 0 = Sunday

/** The next automatic statement run: 00:00 IST on the 1st of next month. */
export const nextBillingRun = (now = Date.now()) => istMonth(1, now).start;

export const formatPaisa = (paisa: number) =>
  `₹${(paisa / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const formatIstDate = (iso: string | Date) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
export const periodLabel = (startIso: string) =>
  new Date(new Date(startIso).getTime() + IST_OFFSET_MS).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export interface InvoiceRow {
  id: string;
  organization_id: string;
  invoice_number: string;
  period_start: string;
  period_end: string;
  total_coin_transactions: number;
  total_amount_paisa: number;
  amount_due_paisa: number;
  status: string;
  due_date: string | null;
  created_at: string;
}

type CreateResult =
  | { status: 'created'; invoice: InvoiceRow }
  | { status: 'exists'; invoice: InvoiceRow | null }
  | { status: 'failed'; error: string };

/** Create one organization's coin statement for [start, end). Never duplicates. */
export async function createInvoice(db: SupabaseClient, organizationId: string, start: Date, end: Date): Promise<CreateResult> {
  const periodStart = start.toISOString();
  const periodEnd = end.toISOString();

  const { data: existing } = await db
    .from('organization_invoices')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('period_start', periodStart)
    .neq('status', 'cancelled')
    .maybeSingle();
  if (existing) return { status: 'exists', invoice: existing as InvoiceRow };

  const { data: amounts, error: calcError } = await db.rpc('calculate_invoice_amounts', {
    p_organization_id: organizationId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
  });
  if (calcError) return { status: 'failed', error: calcError.message };
  const total = Number(amounts?.[0]?.total_amount_paisa || 0);
  const coins = Number(amounts?.[0]?.total_transactions || 0);

  const { data: number, error: numError } = await db.rpc('generate_invoice_number');
  if (numError || !number) return { status: 'failed', error: numError?.message || 'Could not number statement' };

  const { data: invoice, error } = await db
    .from('organization_invoices')
    .insert({
      organization_id: organizationId,
      invoice_number: number,
      period_start: periodStart,
      period_end: periodEnd,
      total_coin_transactions: coins,
      total_amount_paisa: total,
      amount_paid_paisa: 0,
      amount_due_paisa: total,
      // 'pending' = coins waiting to be collected; a month without coins is settled straight away
      status: total > 0 ? 'pending' : 'paid',
      notes: total > 0 ? null : 'No coin payments in this period',
      due_date: new Date(Date.now() + COLLECTION_WINDOW_DAYS * 86_400_000).toISOString(),
    })
    .select('*')
    .single();

  if (error) {
    // Lost a race with a parallel run: the unique (org, period) index kept it to one statement
    if (error.code === '23505') return { status: 'exists', invoice: null };
    return { status: 'failed', error: error.message };
  }
  return { status: 'created', invoice: invoice as InvoiceRow };
}

/** Machines per organization: owned by the org itself or assigned to one of its members. */
async function machineCounts(db: SupabaseClient): Promise<Map<string, number>> {
  const [{ data: machines }, { data: members }] = await Promise.all([
    db.from('vending_machines').select('customer_id'),
    db.from('profiles').select('id, organization_id').not('organization_id', 'is', null),
  ]);
  const orgOf = new Map((members || []).map((p) => [String(p.id), String(p.organization_id)]));
  const counts = new Map<string, number>();
  for (const m of machines || []) {
    const owner = String(m.customer_id || '');
    const org = orgOf.get(owner) || owner;
    counts.set(org, (counts.get(org) || 0) + 1);
  }
  return counts;
}

export interface BillingRunResult {
  period: { start: string; end: string; label: string } | null;
  created: number;
  skipped: number;
  failed: number;
  emailsSent: number;
  overdueMarked: number;
  remindersSent: number;
  details: { organization: string; result: string; invoice?: string; amount?: string; error?: string }[];
}

/** Create every organization's statement for one IST month (default last month) and email Lyra the sheet. */
export async function generateInvoicesForMonth(
  db: SupabaseClient,
  opts: { monthOffset?: number; sendReport?: boolean; now?: number } = {},
): Promise<BillingRunResult> {
  const period = istMonth(opts.monthOffset ?? -1, opts.now);
  const result: BillingRunResult = {
    period: { start: period.start.toISOString(), end: period.end.toISOString(), label: period.label },
    created: 0, skipped: 0, failed: 0, emailsSent: 0, overdueMarked: 0, remindersSent: 0, details: [],
  };
  const [{ data: orgs }, counts] = await Promise.all([db.from('organizations').select('id, name').order('name'), machineCounts(db)]);
  const sheet: (CollectionRow & { paisa: number })[] = [];

  for (const org of orgs || []) {
    const r = await createInvoice(db, org.id, period.start, period.end);
    if (r.status === 'failed') {
      result.failed++;
      result.details.push({ organization: org.name, result: 'failed', error: r.error });
      continue;
    }
    if (r.status === 'created') result.created++;
    else result.skipped++;
    const inv = r.invoice;
    result.details.push({ organization: org.name, result: r.status === 'created' ? 'created' : 'already created', invoice: inv?.invoice_number, amount: inv ? formatPaisa(inv.total_amount_paisa) : undefined });
    if (inv) {
      sheet.push({
        organization: org.name, statement: inv.invoice_number, machines: counts.get(org.id) || 0,
        coins: inv.total_coin_transactions || 0, amount: formatPaisa(inv.total_amount_paisa), paisa: inv.total_amount_paisa,
      });
    }
  }

  // One collection sheet to Lyra, only when this run created something new
  const to = billingReportRecipients();
  if (opts.sendReport !== false && result.created > 0 && to.length) {
    const totalPaisa = sheet.reduce((t, r) => t + r.paisa, 0);
    const mail = collectionReportEmail({
      month: period.label,
      rows: [...sheet].sort((a, b) => b.paisa - a.paisa),
      total: formatPaisa(totalPaisa),
      totalCoins: sheet.reduce((t, r) => t + r.coins, 0),
      collectBy: formatIstDate(new Date(Date.now() + COLLECTION_WINDOW_DAYS * 86_400_000)),
    });
    const csv = ['Organization,Statement,Machines,Coins,Amount (INR)']
      .concat(sheet.map((r) => [r.organization, r.statement, r.machines, r.coins, (r.paisa / 100).toFixed(2)].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')))
      .join('\n');
    const sent = await sendEmail({
      to,
      ...mail,
      attachments: [{ filename: `lyra-coin-collection-${period.label.replace(/\s+/g, '-').toLowerCase()}.csv`, content: csv }],
    });
    if (sent.success) result.emailsSent++;
    else result.details.push({ organization: 'Collection sheet email', result: 'failed', error: sent.error });
  }
  return result;
}

/**
 * Daily upkeep: flag statements not collected by their collect-by date, and email Lyra
 * a digest of uncollected coins when new ones turn overdue (and every Monday while any remain).
 */
export async function runOverdueMaintenance(db: SupabaseClient, now = Date.now()) {
  const { data: marked } = await db.rpc('mark_overdue_invoices');
  const overdueMarked = Number(marked || 0);
  let remindersSent = 0;
  if (overdueMarked > 0 || istWeekday(now) === 1) {
    const { data: rows } = await db
      .from('organization_invoices')
      .select('invoice_number, total_coin_transactions, amount_due_paisa, due_date, organization_id, organizations(name)')
      .eq('status', 'overdue')
      .gt('amount_due_paisa', 0)
      .order('due_date', { ascending: true })
      .limit(200);
    const to = billingReportRecipients();
    if (rows?.length && to.length) {
      const counts = await machineCounts(db);
      const mail = uncollectedDigestEmail({
        total: formatPaisa(rows.reduce((t, r) => t + r.amount_due_paisa, 0)),
        rows: rows.map((r) => ({
          organization: (r.organizations as unknown as { name: string } | null)?.name || 'Organization',
          statement: r.invoice_number,
          machines: counts.get(r.organization_id) || 0,
          coins: r.total_coin_transactions || 0,
          amount: formatPaisa(r.amount_due_paisa),
          collectBy: r.due_date ? formatIstDate(r.due_date) : '—',
        })),
      });
      const sent = await sendEmail({ to, ...mail });
      if (sent.success) remindersSent = 1;
    }
  }
  return { overdueMarked, remindersSent };
}

/** Record a run in billing_runs (best effort). */
export async function logBillingRun(db: SupabaseClient, triggeredBy: string, r: BillingRunResult) {
  const { error } = await db.from('billing_runs').insert({
    triggered_by: triggeredBy,
    period_start: r.period?.start ?? null,
    period_end: r.period?.end ?? null,
    invoices_created: r.created,
    invoices_skipped: r.skipped,
    invoices_failed: r.failed,
    emails_sent: r.emailsSent,
    overdue_marked: r.overdueMarked,
    reminders_sent: r.remindersSent,
    details: r.details,
  });
  if (error) console.error('[billing] could not log run:', error.message);
}

/**
 * The scheduled job (runs daily). On the 1st–3rd (IST) it creates last month's statements for
 * any organization still missing one and emails Lyra the collection sheet; every day it flags
 * uncollected statements and sends Lyra the uncollected digest when needed.
 */
export async function runBillingCron(now = Date.now()): Promise<BillingRunResult> {
  const db = billingDb();
  const inWindow = istDayOfMonth(now) <= GENERATION_WINDOW_DAYS;
  const result: BillingRunResult = inWindow
    ? await generateInvoicesForMonth(db, { monthOffset: -1, now })
    : { period: null, created: 0, skipped: 0, failed: 0, emailsSent: 0, overdueMarked: 0, remindersSent: 0, details: [] };
  const upkeep = await runOverdueMaintenance(db, now);
  result.overdueMarked = upkeep.overdueMarked;
  result.remindersSent = upkeep.remindersSent;
  if (result.created || result.failed || upkeep.overdueMarked || upkeep.remindersSent) await logBillingRun(db, 'cron', result);
  return result;
}

/** Email one statement to Lyra's billing inbox (e.g. from the statement page). */
export async function emailStatementToLyra(db: SupabaseClient, invoiceId: string): Promise<{ ok: true; to: string } | { ok: false; error: string }> {
  const to = billingReportRecipients();
  if (!to.length) return { ok: false, error: 'Set BILLING_REPORT_EMAIL to choose where statements go' };
  const { data: inv } = await db
    .from('organization_invoices')
    .select('*, organizations(name)')
    .eq('id', invoiceId)
    .single();
  if (!inv) return { ok: false, error: 'Statement not found' };
  const counts = await machineCounts(db);
  const mail = collectionReportEmail({
    month: periodLabel(inv.period_start),
    rows: [{
      organization: (inv.organizations as { name: string } | null)?.name || 'Organization',
      statement: inv.invoice_number,
      machines: counts.get(inv.organization_id) || 0,
      coins: inv.total_coin_transactions || 0,
      amount: formatPaisa(inv.amount_due_paisa || inv.total_amount_paisa),
    }],
    total: formatPaisa(inv.amount_due_paisa || inv.total_amount_paisa),
    totalCoins: inv.total_coin_transactions || 0,
    collectBy: inv.due_date ? formatIstDate(inv.due_date) : '—',
  });
  const sent = await sendEmail({ to, ...mail });
  if (!sent.success) return { ok: false, error: sent.error || 'Email failed' };
  await db.from('organization_invoices').update({ email_sent: true, email_sent_at: new Date().toISOString() }).eq('id', invoiceId);
  return { ok: true, to: to.join(', ') };
}
