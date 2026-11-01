'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth-helpers';
import { billingDb, emailStatementToLyra, formatPaisa, generateInvoicesForMonth, logBillingRun } from '@/lib/billing';

interface RecordPaymentParams {
  invoiceId: string;
  /** Cash actually counted at collection */
  amountPaisa: number;
  notes?: string;
  /** Counted less than expected: settle the statement anyway and note the shortfall */
  closeShortfall?: boolean;
}

/**
 * Create every organization's coin collection statement for one IST month (default: last
 * month) and email Lyra the collection sheet. Safe to re-run: existing statements are skipped.
 */
export async function generateMonthlyInvoices(monthOffset = -1) {
  const { user } = await requireAdmin();
  if (!Number.isInteger(monthOffset) || monthOffset > 0 || monthOffset < -12) throw new Error('Choose a month in the last year');
  const db = billingDb();
  const result = await generateInvoicesForMonth(db, { monthOffset });
  await logBillingRun(db, user.email || 'admin', result);
  revalidatePath('/admin/billing');
  return { success: true, ...result };
}

/** Email one statement to Lyra's billing inbox (organizations are never emailed). */
export async function sendInvoiceEmail({ invoiceId }: { invoiceId: string }) {
  await requireAdmin();
  const r = await emailStatementToLyra(billingDb(), invoiceId);
  if (!r.ok) throw new Error(r.error);
  revalidatePath('/admin/billing');
  return { success: true, message: `Email sent to ${r.to}` };
}

/**
 * Record the coins collected from an organization's machines. The DB trigger credits the
 * statement; a count above the expected amount settles it, and a shortfall can be closed.
 */
export async function recordManualPayment({ invoiceId, amountPaisa, notes, closeShortfall }: RecordPaymentParams) {
  await requireAdmin();
  const db = billingDb();
  if (!Number.isFinite(amountPaisa) || amountPaisa <= 0) throw new Error('Enter an amount greater than zero');

  const { data: invoice } = await db
    .from('organization_invoices')
    .select('id, organization_id, amount_due_paisa, status')
    .eq('id', invoiceId)
    .single();
  if (!invoice) throw new Error('Statement not found');
  if (invoice.status === 'cancelled') throw new Error('This statement is cancelled');
  if (invoice.amount_due_paisa <= 0) throw new Error('This statement is already fully collected');
  const expected = invoice.amount_due_paisa;
  const diff = Math.round(amountPaisa) - expected;
  const variance = diff === 0 ? 'matches the system' : diff > 0 ? `${formatPaisa(diff)} more than the system` : `${formatPaisa(-diff)} short`;

  const { data: payment, error } = await db
    .from('organization_payments')
    .insert({
      invoice_id: invoiceId,
      organization_id: invoice.organization_id,
      amount_paisa: Math.round(amountPaisa),
      payment_method: 'cash_collection',
      status: 'success',
      notes: [`Coins collected: ${formatPaisa(Math.round(amountPaisa))} (expected ${formatPaisa(expected)}, ${variance})`, notes?.trim()].filter(Boolean).join(' · '),
      payment_date: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  if (diff < 0 && closeShortfall) {
    await db
      .from('organization_invoices')
      .update({ status: 'paid', amount_due_paisa: 0, paid_at: new Date().toISOString(), notes: `Closed with shortfall of ${formatPaisa(-diff)}`, updated_at: new Date().toISOString() })
      .eq('id', invoiceId);
  }

  revalidatePath('/admin/billing');
  revalidatePath(`/admin/billing/${invoiceId}`);
  return { success: true, payment, variance };
}

/** All invoices with their organization (admin only). */
export async function getAllInvoices() {
  await requireAdmin();
  const { data: invoices, error } = await billingDb()
    .from('organization_invoices')
    .select('*, organizations(id, name, contact_email)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return { success: true, invoices };
}

/** One invoice with its payments: admins, or the super customer of that organization. */
export async function getInvoiceDetails(invoiceId: string) {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const db = billingDb();
  const { data: invoice, error } = await db
    .from('organization_invoices')
    .select('*, organizations(id, name, contact_email), organization_payments(id, amount_paisa, payment_method, status, payment_date, razorpay_payment_id, notes)')
    .eq('id', invoiceId)
    .single();
  if (error || !invoice) throw new Error('Invoice not found');

  const { data: profile } = await db.from('profiles').select('role, account_type, organization_id').eq('id', user.id).single();
  const allowed = profile?.role === 'admin'
    || (profile?.account_type === 'super_customer' && profile.organization_id === invoice.organization_id);
  if (!allowed) throw new Error('Invoice not found');

  return { success: true, invoice };
}

/** Delete an invoice that has no recorded payments (paid invoices must be kept for the books). */
export async function deleteInvoice(invoiceId: string) {
  await requireAdmin();
  const db = billingDb();
  const { count } = await db
    .from('organization_payments')
    .select('id', { count: 'exact', head: true })
    .eq('invoice_id', invoiceId)
    .eq('status', 'success');
  if (count) throw new Error('This invoice has payments recorded against it and cannot be deleted');

  const { error } = await db.from('organization_invoices').delete().eq('id', invoiceId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/billing');
  return { success: true, message: 'Invoice deleted' };
}
