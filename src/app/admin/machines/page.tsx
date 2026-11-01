import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { Plus, Building2, Wifi, WifiOff, PackageOpen } from 'lucide-react';
import { BarList, EmptyState, PageHeader, Panel, RingStat, StatGrid, StatTile } from '@/components/ui/kit';
import MachinesTable from '@/components/MachinesTable';
import { isMachineOnline } from '@/lib/machine-status';

export const revalidate = 0;

export default async function MachinesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('account_type, role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') redirect('/customer/dashboard');

  const { data: machines } = await serviceSupabase
    .from('vending_machines')
    .select('*')
    .order('created_at', { ascending: false });

  const machinesWithUpdatedStatus = (machines || []).map((machine) => ({
    ...machine,
    asset_online: isMachineOnline(machine.last_ping),
  }));

  const total = machinesWithUpdatedStatus.length;
  const online = machinesWithUpdatedStatus.filter((m) => m.asset_online).length;
  const offline = total - online;
  const lowStock = machinesWithUpdatedStatus.filter((m) => typeof m.stock_level === 'number' && m.stock_level < 5).length;
  const byOrg = Object.entries(
    machinesWithUpdatedStatus.reduce<Record<string, number>>((acc, m) => {
      const k = m.customer_name || 'Unassigned';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value]) => ({ label, value }));

  const stocked = machinesWithUpdatedStatus.filter((m) => typeof m.stock_level === 'number' && m.max_capacity);
  const stockCap = {
    stock: stocked.reduce((t, m) => t + (m.stock_level || 0), 0),
    cap: stocked.reduce((t, m) => t + (m.max_capacity || 0), 0),
    low: lowStock,
  };

  const addButton = (
    <Link href="/admin/machines/new" className="lyra-cta" style={{ minHeight: 40, padding: '8px 18px', fontSize: 14 }}>
      <Plus className="w-4 h-4" />
      Add machine
    </Link>
  );

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
      <PageHeader eyebrow="Fleet" title="Vending machines" subtitle="Live status, stock and assignment for every machine" actions={addButton} />

      {total > 0 ? (
        <>
          <StatGrid>
            <StatTile tone="sky"    icon={Building2}   label="Total"     value={String(total)}   sub="machines registered" />
            <StatTile tone="mint"   icon={Wifi}        label="Online"    value={String(online)}  sub={`${total ? Math.round((online / total) * 100) : 0}% of fleet`} />
            <StatTile tone="peach"  icon={WifiOff}     label="Offline"   value={String(offline)} sub={offline ? 'need attention' : 'all good'} />
            <StatTile tone="butter" icon={PackageOpen} label="Low stock" value={String(lowStock)} sub="under 5 units" />
          </StatGrid>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-5 mb-6">
            <Panel title="Statistics">
              <div className="flex flex-col gap-3">
                <RingStat label="Machines online" sub={machinesWithUpdatedStatus.length - online ? `${machinesWithUpdatedStatus.length - online} offline` : 'all connected'} value={online} max={Math.max(machinesWithUpdatedStatus.length, 1)} tone={machinesWithUpdatedStatus.length - online ? 'warn' : 'ok'} />
                <RingStat label="Fleet stock" sub={`${stockCap.low} need refill`} value={stockCap.stock} max={Math.max(stockCap.cap, 1)} tone={stockCap.low ? 'warn' : 'accent'} />
              </div>
            </Panel>
            <Panel title="Machines per organization">
              <BarList items={byOrg} />
            </Panel>
          </div>

          <Suspense fallback={null}>
            <MachinesTable machines={machinesWithUpdatedStatus} />
          </Suspense>
        </>
      ) : (
        <Panel>
          <EmptyState icon={Building2} title="No vending machines yet" hint="Add your first machine to get started" action={addButton} />
        </Panel>
      )}
    </main>
  );
}
