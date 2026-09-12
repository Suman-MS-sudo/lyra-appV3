import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { Building2, Activity } from 'lucide-react';
import { CustomerMachinesTable } from '@/components/CustomerMachinesTable';

export const revalidate = 0;

const CARD: React.CSSProperties = {
  border: '1px solid #e5e5e7',
  borderRadius: 20,
};

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

  let customerMachines;
  if (isSuperCustomer && profile?.organization_id) {
    const { data: machines } = await serviceSupabase
      .from('vending_machines')
      .select('*, last_ping')
      .eq('customer_id', profile.organization_id)
      .order('created_at', { ascending: false });
    customerMachines = machines;
  } else {
    const { data: machines } = await serviceSupabase
      .from('vending_machines')
      .select('*, last_ping')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });
    customerMachines = machines;
  }

  const machinesWithUpdatedStatus = customerMachines?.map(machine => {
    if (machine.last_ping) {
      const lastPingTime = new Date(machine.last_ping).getTime();
      machine.asset_online = (Date.now() - lastPingTime) < 10 * 60 * 1000;
    } else {
      machine.asset_online = false;
    }
    return machine;
  }) || [];

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

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-[#1d1d1f]">My Machines</h1>
        <p className="text-sm mt-0.5" style={{ color: '#6e6e73' }}>View and monitor all your vending machines</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Machines */}
        <div className="rounded-2xl p-5 relative overflow-hidden" style={CARD}>
          <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full" style={{ background: 'rgba(0,113,227,0.10)', opacity: 0.15 }} />
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(0,113,227,0.10)' }}>
            <Building2 className="w-5 h-5" style={{ color: '#0071e3' }} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#6e6e73' }}>Total Machines</p>
          <p className="text-2xl font-bold text-[#1d1d1f]">{machinesWithStats.length}</p>
        </div>

        {/* Online */}
        <div className="rounded-2xl p-5 relative overflow-hidden" style={CARD}>
          <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full" style={{ background: 'rgba(29,122,60,0.12)', opacity: 0.15 }} />
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(29,122,60,0.12)' }}>
            <Activity className="w-5 h-5" style={{ color: '#1d7a3c' }} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#6e6e73' }}>Online</p>
          <p className="text-2xl font-bold" style={{ color: '#1d7a3c' }}>{onlineCount}</p>
        </div>

        {/* Low Stock */}
        <div className="rounded-2xl p-5 relative overflow-hidden" style={CARD}>
          <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full" style={{ background: 'rgba(154,100,0,0.12)', opacity: 0.15 }} />
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(154,100,0,0.12)' }}>
            <Building2 className="w-5 h-5" style={{ color: '#9a6400' }} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#6e6e73' }}>Low Stock</p>
          <p className="text-2xl font-bold" style={{ color: '#9a6400' }}>{lowStockCount}</p>
        </div>

        {/* Total Revenue (super customer only) */}
        {isSuperCustomer ? (
          <div className="rounded-2xl p-5 relative overflow-hidden" style={CARD}>
            <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full" style={{ background: 'rgba(0,0,0,0.04)', opacity: 0.15 }} />
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(0,0,0,0.04)' }}>
              <Activity className="w-5 h-5" style={{ color: '#0071e3' }} />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#6e6e73' }}>Total Revenue</p>
            <p className="text-2xl font-bold text-[#1d1d1f]">₹{formatAmount(totalRevenue)}</p>
          </div>
        ) : (
          <div className="rounded-2xl p-5 relative overflow-hidden" style={CARD}>
            <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full" style={{ background: 'rgba(0,0,0,0.04)', opacity: 0.15 }} />
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(0,0,0,0.04)' }}>
              <Building2 className="w-5 h-5" style={{ color: '#0071e3' }} />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#6e6e73' }}>Offline</p>
            <p className="text-2xl font-bold" style={{ color: '#0071e3' }}>{machinesWithStats.length - onlineCount}</p>
          </div>
        )}
      </div>

      <CustomerMachinesTable machines={machinesWithStats} isSuperCustomer={isSuperCustomer} />
    </main>
  );
}
