import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { Building2, Activity, IndianRupee, PackageOpen, WifiOff } from 'lucide-react';
import { BarList, PageHeader, Panel, RingStat, StatGrid, StatTile } from '@/components/ui/kit';
import { CustomerMachinesTable } from '@/components/CustomerMachinesTable';
import { isMachineOnline } from '@/lib/machine-status';
import { visibleOwnerIds } from '@/lib/machine-scope';

export const revalidate = 0;

export default async function CustomerMachinesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profile?.role === 'admin') redirect('/admin/dashboard');

  const isSuperCustomer = profile?.account_type === 'super_customer';

  // Every machine in the company for super customers (including ones assigned
  // to a team member); only their own for regular customers.
  const ownerIds = await visibleOwnerIds(serviceSupabase, user.id, profile);
  const { data: customerMachines } = await serviceSupabase
    .from('vending_machines')
    .select('*, last_ping')
    .in('customer_id', ownerIds)
    .order('created_at', { ascending: false });

  // Names of team members machines are assigned to
  const memberIds = ownerIds.filter((id) => id !== profile?.organization_id && id !== user.id);
  const { data: members } = memberIds.length
    ? await serviceSupabase.from('profiles').select('id, full_name, email').in('id', memberIds)
    : { data: [] as { id: string; full_name: string | null; email: string }[] };
  const memberName = new Map((members || []).map((m) => [m.id, m.full_name || m.email]));

  const machinesWithUpdatedStatus = (customerMachines || []).map((machine) => ({
    ...machine,
    asset_online: isMachineOnline(machine.last_ping),
    assignee: memberName.get(machine.customer_id) ?? null,
  }));

  const machineIds = machinesWithUpdatedStatus.map(m => m.id);

  const [
    { data: onlineTransactions },
    { data: coinPayments },
    { data: rfidPayments },
  ] = await Promise.all([
    serviceSupabase.from('transactions').select('machine_id, total_amount, payment_status').in('machine_id', machineIds),
    serviceSupabase.from('coin_payments').select('machine_id, amount_in_paisa').in('machine_id', machineIds),
    serviceSupabase.from('rfid_payments').select('machine_id, amount_in_paisa').in('machine_id', machineIds),
  ]);

  const machinesWithStats = machinesWithUpdatedStatus.map(machine => {
    const machineOnlineTx = onlineTransactions?.filter(tx => tx.machine_id === machine.id && tx.payment_status === 'paid') || [];
    const machineCoinTx = coinPayments?.filter(tx => tx.machine_id === machine.id) || [];
    const machineRfidTx = rfidPayments?.filter(tx => tx.machine_id === machine.id) || [];
    const onlineRevenue = machineOnlineTx.reduce((sum, tx) => sum + parseFloat(tx.total_amount || '0'), 0);
    const coinRevenue = machineCoinTx.reduce((sum, tx) => sum + (tx.amount_in_paisa / 100), 0);
    const rfidRevenue = machineRfidTx.reduce((sum, tx) => sum + (tx.amount_in_paisa / 100), 0);
    return {
      ...machine,
      onlineTransactions: machineOnlineTx.length,
      coinTransactions: machineCoinTx.length,
      rfidTransactions: machineRfidTx.length,
      totalTransactions: machineOnlineTx.length + machineCoinTx.length + machineRfidTx.length,
      totalRevenue: onlineRevenue + coinRevenue + rfidRevenue,
    };
  });

  const onlineCount = machinesWithStats.filter(m => m.asset_online).length;
  const lowStockCount = machinesWithStats.filter(m => m.stock_level !== null && m.stock_level < 5).length;
  const totalRevenue = machinesWithStats.reduce((sum, m) => sum + m.totalRevenue, 0);

  const formatAmount = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const offlineCount = machinesWithStats.length - onlineCount;
  const stocked = machinesWithStats.filter((m) => typeof m.stock_level === 'number' && m.max_capacity);
  const stockCap = {
    stock: stocked.reduce((t, m) => t + (m.stock_level || 0), 0),
    cap: stocked.reduce((t, m) => t + (m.max_capacity || 0), 0),
    low: lowStockCount,
  };
  const ranking = isSuperCustomer
    ? [...machinesWithStats].sort((x, y) => y.totalRevenue - x.totalRevenue).slice(0, 6).map((m) => ({ label: m.name, value: m.totalRevenue }))
    : [...machinesWithStats].filter((m) => m.stock_level !== null).sort((x, y) => (x.stock_level ?? 0) - (y.stock_level ?? 0)).slice(0, 6).map((m) => ({ label: m.name, value: m.stock_level ?? 0 }));

  // Super customers: how many machines each team member holds (company pool = not assigned to anyone)
  const POOL = '__pool';
  const byUser = new Map<string, { label: string; machines: number; online: number; revenue: number }>();
  for (const id of memberIds) byUser.set(id, { label: memberName.get(id) || 'Team member', machines: 0, online: 0, revenue: 0 });
  byUser.set(POOL, { label: 'Company pool (unassigned)', machines: 0, online: 0, revenue: 0 });
  for (const m of machinesWithStats) {
    const row = byUser.get(memberName.has(m.customer_id) ? m.customer_id : POOL)!;
    row.machines += 1;
    if (m.asset_online) row.online += 1;
    row.revenue += m.totalRevenue;
  }
  const machinesByUser = [...byUser.values()]
    .filter((r) => r.machines > 0 || r.label !== 'Company pool (unassigned)')
    .sort((a, b) => b.machines - a.machines || a.label.localeCompare(b.label))
    .map((r) => ({
      label: r.label,
      value: r.machines,
      sub: r.machines ? `${r.online} online · ${r.machines - r.online} offline · ₹${formatAmount(r.revenue)}` : 'No machines assigned',
    }));
  const assignedCount = machinesByUser.filter((r) => !r.label.startsWith('Company pool')).reduce((t, r) => t + r.value, 0);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
      <PageHeader eyebrow="Fleet" title="My machines" subtitle="Live status, stock and revenue for each of your machines" />

      <StatGrid>
        <StatTile tone="sky"    icon={Building2}   label="Machines"  value={String(machinesWithStats.length)} sub="in your network" />
        <StatTile tone="mint"   icon={Activity}    label="Online"    value={String(onlineCount)} sub={`${offlineCount} offline`} />
        <StatTile tone="butter" icon={PackageOpen} label="Low stock" value={String(lowStockCount)} sub="under 5 units" />
        {isSuperCustomer
          ? <StatTile tone="lilac" icon={IndianRupee} label="Revenue" value={`₹${formatAmount(totalRevenue)}`} sub="all machines" />
          : <StatTile tone="peach" icon={WifiOff}     label="Offline" value={String(offlineCount)} sub={offlineCount ? 'need attention' : 'all good'} />}
      </StatGrid>

      {machinesWithStats.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-5 mb-6">
          <div className="flex flex-col gap-5 min-w-0">
            <Panel title="Statistics">
              <div className="flex flex-col gap-3">
                <RingStat label="Machines online" sub={machinesWithStats.length - onlineCount ? `${machinesWithStats.length - onlineCount} offline` : 'all connected'} value={onlineCount} max={Math.max(machinesWithStats.length, 1)} tone={machinesWithStats.length - onlineCount ? 'warn' : 'ok'} />
                <RingStat label="Stock level" sub={`${stockCap.low} need refill`} value={stockCap.stock} max={Math.max(stockCap.cap, 1)} tone={stockCap.low ? 'warn' : 'accent'} />
              </div>
            </Panel>
            {isSuperCustomer && (
              <Panel title="Machines by user" href="/customer/users" hrefLabel="Manage">
                <p className="text-xs -mt-3 mb-2 text-[var(--muted)]">
                  {assignedCount} of {machinesWithStats.length} assigned to {machinesByUser.filter((r) => !r.label.startsWith('Company pool') && r.value > 0).length} people
                </p>
                <BarList items={machinesByUser} format={(n) => `${n} machine${n === 1 ? '' : 's'}`} />
              </Panel>
            )}
          </div>
          <Panel title={isSuperCustomer ? 'Revenue by machine' : 'Lowest stock first'}>
            <BarList items={ranking} format={isSuperCustomer ? (n) => `₹${formatAmount(n)}` : (n) => `${n} left`} />
          </Panel>
        </div>
      )}

      <CustomerMachinesTable machines={machinesWithStats} isSuperCustomer={isSuperCustomer} />
    </main>
  );
}
