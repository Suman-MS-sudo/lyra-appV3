import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { AdminRentalsClient, type AdminRental } from '@/components/AdminRentalsClient';
import { rentalState } from '@/lib/rental-state';

import { Donut, PageHeader, Panel, StatGrid, StatTile } from '@/components/ui/kit';
import { CheckCircle2, Clock, IndianRupee, PauseCircle } from 'lucide-react';

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
        <h1 className="ui-title">Rentals</h1>
        <p className="mt-3 text-sm text-[var(--danger)]">
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
    <div className="px-4 sm:px-8 py-8 max-w-7xl mx-auto">
      <PageHeader title="Rentals" subtitle="Booked and recharged on lyraenterprise.co.in. Start a rental at installation to begin its paid period." />
      <StatGrid>
        <StatTile tone="mint"   icon={CheckCircle2}  label="Active"         value={String(count('active'))}          sub={`${count('pending_install')} awaiting install`} />
        <StatTile tone="butter" icon={Clock}         label="In grace"       value={String(count('grace'))}           sub="rent overdue, still vending" />
        <StatTile tone="peach"  icon={PauseCircle}   label="Paused"         value={String(count('locked'))}          sub="unpaid — vending paused" />
        <StatTile tone="sky"    icon={IndianRupee}   label="Monthly rent"   value={`₹${monthly.toLocaleString('en-IN')}`} sub="ex-GST, live rentals" />
      </StatGrid>
      <Panel title="Rentals by status" className="mb-6">
        <Donut
          centerValue={String(rows.length)}
          centerLabel="RENTALS"
          slices={[
            { label: 'Active', value: count('active'), color: '#45b558' },
            { label: 'Awaiting install', value: count('pending_install'), color: '#a1a1aa' },
            { label: 'In grace', value: count('grace'), color: '#f0be3c' },
            { label: 'Paused', value: count('locked'), color: '#f03b2a' },
            { label: 'Ended / cancelled', value: count('ended') + count('cancelled'), color: '#8a93a3' },
          ]}
        />
      </Panel>
      <AdminRentalsClient rows={rows} machines={(machines ?? []).map((m) => ({ id: m.id, label: `${m.machine_name || m.machine_id} · ${m.location ?? ''}` }))} />
    </div>
  );
}
