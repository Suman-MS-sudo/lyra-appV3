'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

/**
 * Admin actions for machine rentals (booked and recharged on lyraenterprise.co.in).
 * Tables and functions: supabase/migrations/20261026000001_rental_recharges.sql
 */

const service = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

async function requireAdminUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  const { data: profile } = await service().from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') throw new Error('Forbidden');
  return user;
}

export type ActionResult = { ok: true } | { ok: false, error: string };

const done = (): ActionResult => {
  revalidatePath('/admin/rentals');
  return { ok: true };
};
const fail = (e: unknown): ActionResult => ({ ok: false, error: e instanceof Error ? e.message : String(e) });

/** At installation: link the machine and set the start date. Banked months become a paid-until date. */
export async function startRental(agreementId: string, machineId: string, startDate: string): Promise<ActionResult> {
  try {
    await requireAdminUser();
    if (!machineId) throw new Error('Choose the installed machine');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new Error('Choose the installation date');
    const { error } = await service().rpc('start_rental', { p_agreement: agreementId, p_machine: machineId, p_start: startDate });
    if (error) throw new Error(error.message);
    return done();
  } catch (e) {
    return fail(e);
  }
}

/** Records rent paid outside the website (cash, cheque, bank transfer) and extends the rental. */
export async function recordManualRecharge(agreementId: string, months: number, amountPaid: number, reference: string): Promise<ActionResult> {
  try {
    const user = await requireAdminUser();
    if (!Number.isInteger(months) || months < 1 || months > 36) throw new Error('Months must be between 1 and 36');
    if (!(amountPaid >= 0)) throw new Error('Enter the amount received');
    const db = service();
    const { data: a, error: aErr } = await db.from('rental_agreements').select('id, monthly_rent').eq('id', agreementId).single();
    if (aErr || !a) throw new Error('Rental not found');
    const ref = `manual:${reference.trim().slice(0, 60) || new Date().toISOString()}:${user.id.slice(0, 8)}`;
    const { data: r, error: rErr } = await db
      .from('rental_recharges')
      .insert({
        agreement_id: a.id,
        kind: 'manual',
        months,
        rent_amount: Number(a.monthly_rent) * months,
        total_amount: amountPaid,
        source: 'admin',
        razorpay_order_id: ref,
      })
      .select('id')
      .single();
    if (rErr || !r) throw new Error(rErr?.message || 'Could not save the payment');
    const { error } = await db.rpc('apply_rental_recharge', { p_recharge: r.id, p_payment_id: ref });
    if (error) throw new Error(error.message);
    return done();
  } catch (e) {
    return fail(e);
  }
}

export async function setRentalStatus(agreementId: string, status: 'open' | 'ended' | 'cancelled'): Promise<ActionResult> {
  try {
    await requireAdminUser();
    const { error } = await service().from('rental_agreements').update({ status }).eq('id', agreementId);
    if (error) throw new Error(error.message);
    return done();
  } catch (e) {
    return fail(e);
  }
}

export async function setDepositStatus(agreementId: string, depositStatus: 'none' | 'held' | 'refunded' | 'adjusted'): Promise<ActionResult> {
  try {
    await requireAdminUser();
    const { error } = await service().from('rental_agreements').update({ deposit_status: depositStatus }).eq('id', agreementId);
    if (error) throw new Error(error.message);
    return done();
  } catch (e) {
    return fail(e);
  }
}
