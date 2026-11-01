import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { RENTAL_RECHARGE_URL } from '@/lib/rental-lock';
import { RENTAL_GRACE_DAYS, RENTAL_STATE_UI, fmtDate, rentalState } from '@/lib/rental-state';
import { AlertTriangle, CalendarClock, CheckCircle2, KeyRound } from 'lucide-react';
import { PageHeader, StatGrid, StatTile } from '@/components/ui/kit';
import { visibleOwnerIds } from '@/lib/machine-scope';

export const revalidate = 0;

const CARD: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 20,
  boxShadow: 'var(--shadow-card)',
};
/** Whole days from now until a YYYY-MM-DD date (negative = overdue). */
function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
}

const inr = (n: number) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/** Rental status for the signed-in customer's machines, with a link to recharge on the website. */
export default async function CustomerRentalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const db = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: profile } = await db.from('profiles').select('*').eq('id', user.id).single();
  if (profile?.role === 'admin') redirect('/admin/rentals');

  // Same machine scoping as /customer/machines (company-wide for super customers).
  const { data: machines } = await db.from('vending_machines').select('id, machine_name, machine_id, location').in('customer_id', await visibleOwnerIds(db, user.id, profile));
  const machineIds = (machines ?? []).map((m) => m.id);

  const agreements = machineIds.length
    ? (await db.from('rental_agreements').select('*').in('machine_id', machineIds).order('rental_code')).data ?? []
    : [];
  const ids = agreements.map((a) => a.id);
  const recharges = ids.length
    ? (
        await db
          .from('rental_recharges')
          .select('agreement_id, kind, months, total_amount, paid_at, period_start, period_end')
          .in('agreement_id', ids)
          .eq('status', 'paid')
          .order('paid_at', { ascending: false })
      ).data ?? []
    : [];

  const machineById = new Map((machines ?? []).map((m) => [m.id, m]));

  return (
    <div className="px-4 sm:px-8 py-8 max-w-5xl mx-auto">
      <PageHeader
        eyebrow="Rental"
        title="Machine rent"
        subtitle={`Recharge Monthly, Quarterly (save 5%) or Yearly (save 10%). Machines keep working for ${RENTAL_GRACE_DAYS} days after the due date; after that, UPI and RFID vending pauses until rent is recharged.`}
      />

      {agreements.length > 0 && (() => {
        const states = agreements.map((a) => rentalState(a));
        const needs = states.filter((st) => st === 'grace' || st === 'locked').length;
        const due = agreements.map((a) => a.paid_until).filter(Boolean).sort()[0] as string | undefined;
        return (
          <StatGrid>
            <StatTile tone="sky"    icon={KeyRound}      label="Rented machines" value={String(agreements.length)} sub="on your account" />
            <StatTile tone="mint"   icon={CheckCircle2}  label="Active"          value={String(states.filter((st) => st === 'active').length)} sub="paid and vending" />
            <StatTile tone="peach"  icon={AlertTriangle} label="Needs recharge"  value={String(needs)} sub={needs ? 'recharge to avoid a pause' : 'nothing overdue'} />
            <StatTile tone="butter" icon={CalendarClock} label="Next due"        value={due ? fmtDate(due) : '—'} sub="earliest paid-until date" />
          </StatGrid>
        );
      })()}

      {agreements.length === 0 ? (
        <div className="mt-8 p-8 text-center bg-[var(--surface)]" style={CARD}>
          <p className="text-sm text-[var(--muted)]">No rented machines are linked to your account yet.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {agreements.map((a) => {
            const state = rentalState(a);
            const ui = RENTAL_STATE_UI[state];
            const m = a.machine_id ? machineById.get(a.machine_id) : null;
            const history = recharges.filter((r) => r.agreement_id === a.id).slice(0, 5);
            const href = `${RENTAL_RECHARGE_URL}?code=${encodeURIComponent(a.rental_code)}&src=dashboard`;
            return (
              <div key={a.id} className="bg-[var(--surface)] p-5 sm:p-6" style={CARD}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm font-semibold text-[var(--fg)]">{a.rental_code}</p>
                    <p className="text-sm text-[var(--muted)]">
                      {m ? `${m.machine_name || m.machine_id} · ${m.location ?? ''}` : a.model_name} · {a.capacity}-napkin plan · {inr(a.monthly_rent)}/month + GST
                    </p>
                  </div>
                  <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: ui.bg, color: ui.fg }}>
                    {ui.label}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                  <p className="text-sm text-[var(--fg)]">
                    {a.start_date ? (
                      <>
                        Paid until <strong>{fmtDate(a.paid_until)}</strong> · started {fmtDate(a.start_date)}
                        {(() => {
                          const d = daysUntil(a.paid_until);
                          if (d == null) return null;
                          const tone = d < 0 ? 'is-bad' : d <= 5 ? 'is-warn' : 'is-ok';
                          return <span className={`ui-pill ${tone} ml-2 align-middle`}><span className="ui-pill-dot" />{d < 0 ? `${-d} days overdue` : `${d} days left`}</span>;
                        })()}
                      </>
                    ) : (
                      <>{a.prepaid_months} prepaid month(s), starting at installation</>
                    )}
                  </p>
                  {a.status === 'open' && (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="lyra-cta"
                      style={{ background: state === 'locked' || state === 'grace' ? 'var(--danger)' : 'var(--accent)' }}
                    >
                      {state === 'locked' ? 'Recharge to restore' : 'Recharge rent'}
                    </a>
                  )}
                </div>

                {history.length > 0 && (
                  <table className="mt-5 w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-[var(--muted)]">
                        <th className="py-1.5 font-medium">Paid on</th>
                        <th className="py-1.5 font-medium">Plan</th>
                        <th className="py-1.5 font-medium">Covers</th>
                        <th className="py-1.5 font-medium text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((r, k) => (
                        <tr key={k}>
                          <td className="py-2">{r.paid_at?.slice(0, 10)}</td>
                          <td className="py-2 capitalize">
                            {r.kind} ({r.months} mo)
                          </td>
                          <td className="py-2">{r.period_start ? `${fmtDate(r.period_start)} – ${fmtDate(r.period_end)}` : 'From installation'}</td>
                          <td className="py-2 text-right">{inr(r.total_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
