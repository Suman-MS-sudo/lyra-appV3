import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { AdminRentalsClient, type AdminRental } from '@/components/AdminRentalsClient';
import { rentalState } from '@/lib/rental-state';

export const revalidate = 0;

export default async function AdminRentalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const db = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/customer/dashboard');

  const [{ data: agreements, error }, { data: machines }, { data: recharges }] = await Promise.all([
    db.from('rental_agreements').select('*').order('created_at', { ascending: false }),
    db.from('vending_machines').select('id, machine_name, machine_id, location').order('machine_name'),
    db.from('rental_recharges').select('agreement_id, kind, months, total_amount, status, paid_at, source').eq('status', 'paid').order('paid_at', { ascending: false }),
  ]);

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-[#1d1d1f]">Rentals</h1>
        <p className="mt-3 text-sm text-[#c8102e]">
          Couldn&apos;t load rentals: {error.message}. Apply supabase/migrations/20261026000001_rental_recharges.sql first.
        </p>
      </div>
    );
  }

  const machineName = new Map((machines ?? []).map((m) => [m.id, `${m.machine_name || m.machine_id} · ${m.location ?? ''}`]));
  const rows: AdminRental[] = (agreements ?? []).map((a) => {
    const paid = (recharges ?? []).filter((r) => r.agreement_id === a.id);
    return {
      ...a,
      state: rentalState(a),
      machine_label: a.machine_id ? machineName.get(a.machine_id) ?? a.machine_id : null,
      total_paid: paid.reduce((n, r) => n + Number(r.total_amount), 0),
      last_payment: paid[0] ?? null,
    };
  });

  const order = { locked: 0, grace: 1, pending_install: 2, active: 3, ended: 4, cancelled: 5 } as const;
  rows.sort((x, y) => order[x.state] - order[y.state]);

  const count = (s: AdminRental['state']) => rows.filter((r) => r.state === s).length;
  const monthly = rows.filter((r) => r.state !== 'ended' && r.state !== 'cancelled').reduce((n, r) => n + Number(r.monthly_rent), 0);

  return (
    <div className="px-4 sm:px-6 py-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1d1d1f]">Rentals</h1>
          <p className="text-sm text-[#6e6e73] mt-1">Booked and recharged on lyraenterprise.co.in. Start a rental at installation to begin its paid period.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
        {[
          ['Awaiting install', count('pending_install')],
          ['Active', count('active')],
          ['In grace', count('grace')],
          ['Paused', count('locked')],
          ['Monthly rent (ex-GST)', `₹${monthly.toLocaleString('en-IN')}`],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-[#e5e5e7] bg-white p-4">
            <p className="text-xs text-[#6e6e73]">{label}</p>
            <p className="text-xl font-semibold text-[#1d1d1f] mt-1">{value}</p>
          </div>
        ))}
      </div>
      <AdminRentalsClient rows={rows} machines={(machines ?? []).map((m) => ({ id: m.id, label: `${m.machine_name || m.machine_id} · ${m.location ?? ''}` }))} />
    </div>
  );
}
