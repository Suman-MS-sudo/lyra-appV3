import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { RENTAL_RECHARGE_URL } from '@/lib/rental-lock';
import { RENTAL_GRACE_DAYS, RENTAL_STATE_UI, fmtDate, rentalState } from '@/lib/rental-state';

export const revalidate = 0;

const CARD: React.CSSProperties = { border: '1px solid #e5e5e7', borderRadius: 20 };
const inr = (n: number) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/** Rental status for the signed-in customer's machines, with a link to recharge on the website. */
export default async function CustomerRentalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const db = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: profile } = await db.from('profiles').select('*').eq('id', user.id).single();
  if (profile?.role === 'admin') redirect('/admin/rentals');

  // Same machine scoping as /customer/machines.
  const ownerId = profile?.account_type === 'super_customer' && profile?.organization_id ? profile.organization_id : user.id;
  const { data: machines } = await db.from('vending_machines').select('id, machine_name, machine_id, location').eq('customer_id', ownerId);
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
    <div className="px-4 sm:px-6 py-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold tracking-tight text-[#1d1d1f]">Rental</h1>
      <p className="text-sm text-[#6e6e73] mt-1">
        Rent status for your rented machines. Recharge Monthly, Quarterly (save 5%) or Yearly (save 10%). Machines keep working for {RENTAL_GRACE_DAYS} days after the
        due date; after that, UPI and RFID vending pauses until rent is recharged.
      </p>

      {agreements.length === 0 ? (
        <div className="mt-8 p-8 text-center bg-white" style={CARD}>
          <p className="text-sm text-[#6e6e73]">No rented machines are linked to your account yet.</p>
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
              <div key={a.id} className="bg-white p-5 sm:p-6" style={CARD}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm font-semibold text-[#1d1d1f]">{a.rental_code}</p>
                    <p className="text-sm text-[#6e6e73]">
                      {m ? `${m.machine_name || m.machine_id} · ${m.location ?? ''}` : a.model_name} · {a.capacity}-napkin plan · {inr(a.monthly_rent)}/month + GST
                    </p>
                  </div>
                  <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: ui.bg, color: ui.fg }}>
                    {ui.label}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                  <p className="text-sm text-[#1d1d1f]">
                    {a.start_date ? (
                      <>
                        Paid until <strong>{fmtDate(a.paid_until)}</strong> · started {fmtDate(a.start_date)}
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
                      className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
                      style={{ background: state === 'locked' || state === 'grace' ? '#c8102e' : '#0071e3' }}
                    >
                      {state === 'locked' ? 'Recharge to restore' : 'Recharge rent'}
                    </a>
                  )}
                </div>

                {history.length > 0 && (
                  <table className="mt-5 w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-[#6e6e73]">
                        <th className="py-1.5 font-medium">Paid on</th>
                        <th className="py-1.5 font-medium">Plan</th>
                        <th className="py-1.5 font-medium">Covers</th>
                        <th className="py-1.5 font-medium text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((r, k) => (
                        <tr key={k} className="border-t border-[#f0f0f2]">
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
