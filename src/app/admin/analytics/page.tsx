import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { TrendingUp, ShoppingCart, Package, Users, DollarSign, Activity, Building2 } from 'lucide-react';

export const revalidate = 0;

const CARD: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 20,
};

function StatCard({
  icon: Icon, label, value, sub, accentColor, iconBg,
}: {
  icon: React.ElementType; label: string; value: string; sub?: string;
  accentColor: string; iconBg: string;
}) {
  return (
    <div className="rounded-2xl p-5 relative overflow-hidden" style={CARD}>
      <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full" style={{ background: iconBg, opacity: 0.15 }} />
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: iconBg }}>
        <Icon className="w-5 h-5" style={{ color: accentColor }} />
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'rgba(255,255,255,0.40)' }}>{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs mt-1 truncate" style={{ color: accentColor }}>{sub}</p>}
    </div>
  );
}

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') redirect('/customer/dashboard');

  const [
    { count: totalTransactions },
    { count: totalCoinPayments },
    { count: totalRfidPayments },
    { count: totalMachines },
    { count: totalProducts },
    { count: totalCustomers },
    { data: recentTransactions },
    { data: topProducts },
    { data: machineStats },
    { data: coinPayments },
    { data: rfidPayments },
    { data: allMachines },
  ] = await Promise.all([
    serviceSupabase.from('transactions').select('*', { count: 'exact', head: true }),
    serviceSupabase.from('coin_payments').select('*', { count: 'exact', head: true }),
    serviceSupabase.from('rfid_payments').select('*', { count: 'exact', head: true }),
    serviceSupabase.from('vending_machines').select('*', { count: 'exact', head: true }),
    serviceSupabase.from('products').select('*', { count: 'exact', head: true }),
    serviceSupabase.from('organizations').select('*', { count: 'exact', head: true }),
    serviceSupabase
      .from('transactions')
      .select('id, total_amount, items, payment_status, created_at, vending_machines!transactions_machine_id_fkey(name, customer_name)')
      .order('created_at', { ascending: false })
      .limit(10),
    serviceSupabase
      .from('transactions')
      .select('items, total_amount, vending_machines!transactions_machine_id_fkey(customer_name)')
      .limit(100),
    serviceSupabase
      .from('vending_machines')
      .select('id, name, machine_id, customer_name, transactions!transactions_machine_id_fkey(total_amount)')
      .limit(10),
    serviceSupabase
      .from('coin_payments')
      .select('id, created_at, amount_in_paisa, product_id, machine_id, products(name), vending_machines(name, customer_name)')
      .limit(100),
    serviceSupabase
      .from('rfid_payments')
      .select('id, created_at, amount_in_paisa, product_id, machine_id, products(name), vending_machines(name, customer_name)')
      .limit(100),
    serviceSupabase.from('vending_machines').select('customer_name, name'),
  ]);

  // Build combined recent transactions (online + coin), sorted by date
  const onlineRows = (recentTransactions || []).map((tx: any) => ({
    id: tx.id,
    type: 'online' as const,
    created_at: tx.created_at,
    machineName: tx.vending_machines?.name || 'N/A',
    productName: (() => {
      const items = typeof tx.items === 'string' ? JSON.parse(tx.items) : tx.items || [];
      return items.map((i: any) => i.name).join(', ') || 'N/A';
    })(),
    total_amount: parseFloat(tx.total_amount || 0),
    payment_status: tx.payment_status || 'pending',
  }));
  const coinRows = (coinPayments || []).map((tx: any) => ({
    id: tx.id,
    type: 'coin' as const,
    created_at: tx.created_at,
    machineName: tx.vending_machines?.name || 'N/A',
    productName: tx.products?.name || 'N/A',
    total_amount: (tx.amount_in_paisa || 0) / 100,
    payment_status: 'paid',
  }));
  const rfidRows = (rfidPayments || []).map((tx: any) => ({
    id: tx.id,
    type: 'rfid' as const,
    created_at: tx.created_at,
    machineName: tx.vending_machines?.name || 'N/A',
    productName: tx.products?.name || 'N/A',
    total_amount: (tx.amount_in_paisa || 0) / 100,
    payment_status: 'paid',
  }));
  const recentCombined = [...onlineRows, ...coinRows, ...rfidRows]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10);

  const { data: allTransactions } = await serviceSupabase
    .from('transactions')
    .select('total_amount, payment_status')
    .eq('payment_status', 'paid');

  const onlineRevenue = allTransactions?.reduce((sum, tx) => sum + (parseFloat(tx.total_amount?.toString() || '0')), 0) || 0;
  const coinRevenue = (coinPayments?.reduce((sum, tx) => sum + (tx.amount_in_paisa || 0), 0) || 0) / 100;
  const rfidRevenue = (rfidPayments?.reduce((sum, tx) => sum + (tx.amount_in_paisa || 0), 0) || 0) / 100;
  const totalRevenue = onlineRevenue + coinRevenue + rfidRevenue;

  const productSales = new Map<string, { name: string; count: number; revenue: number }>();
  topProducts?.forEach((tx: any) => {
    const items = typeof tx.items === 'string' ? JSON.parse(tx.items) : tx.items || [];
    const revenue = parseFloat(tx.total_amount?.toString() || '0');
    items.forEach((item: any) => {
      const productName = item.name || 'Unknown';
      const existing = productSales.get(productName);
      if (existing) { existing.count++; existing.revenue += revenue; }
      else productSales.set(productName, { name: productName, count: 1, revenue });
    });
  });
  coinPayments?.forEach((tx: any) => {
    const productName = tx.products?.name || 'Unknown';
    const revenue = (tx.amount_in_paisa || 0) / 100;
    const existing = productSales.get(productName);
    if (existing) { existing.count++; existing.revenue += revenue; }
    else productSales.set(productName, { name: productName, count: 1, revenue });
  });
  rfidPayments?.forEach((tx: any) => {
    const productName = tx.products?.name || 'Unknown';
    const revenue = (tx.amount_in_paisa || 0) / 100;
    const existing = productSales.get(productName);
    if (existing) { existing.count++; existing.revenue += revenue; }
    else productSales.set(productName, { name: productName, count: 1, revenue });
  });
  const topProductsList = Array.from(productSales.values()).sort((a, b) => b.count - a.count).slice(0, 5);

  const machineRevenueMap = new Map<string, { name: string; revenue: number; count: number }>();
  machineStats?.forEach((machine: any) => {
    const revenue = machine.transactions?.reduce((sum: number, tx: any) =>
      sum + (parseFloat(tx.total_amount?.toString() || '0')), 0) || 0;
    machineRevenueMap.set(machine.name, { name: machine.name, revenue, count: machine.transactions?.length || 0 });
  });
  coinPayments?.forEach((tx: any) => {
    const machineName = tx.vending_machines?.name || 'Unknown';
    const revenue = (tx.amount_in_paisa || 0) / 100;
    const existing = machineRevenueMap.get(machineName);
    if (existing) { existing.revenue += revenue; existing.count++; }
    else machineRevenueMap.set(machineName, { name: machineName, revenue, count: 1 });
  });
  rfidPayments?.forEach((tx: any) => {
    const machineName = tx.vending_machines?.name || 'Unknown';
    const revenue = (tx.amount_in_paisa || 0) / 100;
    const existing = machineRevenueMap.get(machineName);
    if (existing) { existing.revenue += revenue; existing.count++; }
    else machineRevenueMap.set(machineName, { name: machineName, revenue, count: 1 });
  });
  const machineRevenue = Array.from(machineRevenueMap.values()).sort((a, b) => b.revenue - a.revenue);

  const organizationStats = new Map<string, { name: string; onlineCount: number; coinCount: number; rfidCount: number; onlineRevenue: number; coinRevenue: number; rfidRevenue: number }>();
  topProducts?.forEach((tx: any) => {
    const customerName = tx.vending_machines?.customer_name || 'Unknown';
    const revenue = parseFloat(tx.total_amount || 0);
    const existing = organizationStats.get(customerName);
    if (existing) { existing.onlineCount++; existing.onlineRevenue += revenue; }
    else organizationStats.set(customerName, { name: customerName, onlineCount: 1, coinCount: 0, rfidCount: 0, onlineRevenue: revenue, coinRevenue: 0, rfidRevenue: 0 });
  });
  coinPayments?.forEach((tx: any) => {
    const customerName = tx.vending_machines?.customer_name || 'Unknown';
    const revenue = (tx.amount_in_paisa || 0) / 100;
    const existing = organizationStats.get(customerName);
    if (existing) { existing.coinCount++; existing.coinRevenue += revenue; }
    else organizationStats.set(customerName, { name: customerName, onlineCount: 0, coinCount: 1, rfidCount: 0, onlineRevenue: 0, coinRevenue: revenue, rfidRevenue: 0 });
  });
  rfidPayments?.forEach((tx: any) => {
    const customerName = tx.vending_machines?.customer_name || 'Unknown';
    const revenue = (tx.amount_in_paisa || 0) / 100;
    const existing = organizationStats.get(customerName);
    if (existing) { existing.rfidCount++; existing.rfidRevenue += revenue; }
    else organizationStats.set(customerName, { name: customerName, onlineCount: 0, coinCount: 0, rfidCount: 1, onlineRevenue: 0, coinRevenue: 0, rfidRevenue: revenue });
  });
  const organizationList = Array.from(organizationStats.values())
    .sort((a, b) => (b.onlineRevenue + b.coinRevenue + b.rfidRevenue) - (a.onlineRevenue + a.coinRevenue + a.rfidRevenue));

  const organizationMachines = new Map<string, number>();
  allMachines?.forEach((machine: any) => {
    const customerName = machine.customer_name || 'Unknown';
    organizationMachines.set(customerName, (organizationMachines.get(customerName) || 0) + 1);
  });
  const organizationMachineList = Array.from(organizationMachines.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const ACCENT_COLORS = ['#F43F5E', '#A78BFA', '#34D399', '#FBBF24', '#60A5FA', '#F472B6'];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.42)' }}>Comprehensive business insights and trends</p>
        </div>
        <div
          className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-medium"
          style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', color: '#6EE7B7' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live data
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="Total Revenue" value={`₹${totalRevenue.toFixed(2)}`} accentColor="#34D399" iconBg="rgba(52,211,153,0.18)"
          sub={`₹${onlineRevenue.toFixed(2)} online + ₹${coinRevenue.toFixed(2)} coin + ₹${rfidRevenue.toFixed(2)} rfid`} />
        <StatCard icon={ShoppingCart} label="Transactions" value={String((totalTransactions || 0) + (totalCoinPayments || 0) + (totalRfidPayments || 0))} accentColor="#60A5FA" iconBg="rgba(96,165,250,0.18)"
          sub={`${totalTransactions || 0} online · ${totalCoinPayments || 0} coin · ${totalRfidPayments || 0} rfid`} />
        <StatCard icon={Activity} label="Total Machines" value={String(totalMachines || 0)} accentColor="#A78BFA" iconBg="rgba(167,139,250,0.18)"
          sub={`${organizationMachineList.length} organizations`} />
        <StatCard icon={Building2} label="Organizations" value={String(totalCustomers || 0)} accentColor="#FBBF24" iconBg="rgba(251,191,36,0.18)"
          sub="Customer organizations" />
      </div>

      {/* Machines by Organization */}
      <div className="rounded-2xl overflow-hidden" style={CARD}>
        <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <Building2 className="w-4 h-4" style={{ color: '#A78BFA' }} />
          <div>
            <h2 className="font-semibold text-white">Machines by Organization</h2>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.38)' }}>Machine distribution across customer organizations</p>
          </div>
        </div>
        <div className="p-5">
          {organizationMachineList.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {organizationMachineList.map((org, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-4 rounded-xl"
                  style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.15)' }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm truncate">{org.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>Customer organization</p>
                  </div>
                  <div
                    className="ml-3 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                    style={{ background: 'rgba(167,139,250,0.25)', color: '#A78BFA' }}
                  >
                    {org.count}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-8 text-sm" style={{ color: 'rgba(255,255,255,0.28)' }}>No machine data available</p>
          )}
        </div>
      </div>

      {/* Top Products + Machine Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="rounded-2xl overflow-hidden" style={CARD}>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Package className="w-4 h-4" style={{ color: '#60A5FA' }} />
              Top Products
            </h2>
          </div>
          <div className="p-5 space-y-2">
            {topProductsList.length > 0 ? topProductsList.map((product, i) => (
              <div
                key={i}
                className="card-hover flex items-center justify-between p-3 rounded-xl"
              >
                <div>
                  <p className="font-medium text-white text-sm">{product.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>{product.count} sales</p>
                </div>
                <span className="font-bold text-sm" style={{ color: '#34D399' }}>₹{product.revenue.toFixed(2)}</span>
              </div>
            )) : (
              <p className="text-center py-8 text-sm" style={{ color: 'rgba(255,255,255,0.28)' }}>No product data available</p>
            )}
          </div>
        </div>

        {/* Machine Performance */}
        <div className="rounded-2xl overflow-hidden" style={CARD}>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Activity className="w-4 h-4" style={{ color: '#A78BFA' }} />
              Machine Performance
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>Transaction count by machine</p>
          </div>
          <div className="p-5 space-y-4">
            {machineRevenue.length > 0 ? machineRevenue.slice(0, 10).map((machine: any, i: number) => {
              const maxCount = Math.max(...machineRevenue.map((m: any) => m.count), 1);
              const pct = (machine.count / maxCount) * 100;
              const color = ACCENT_COLORS[i % ACCENT_COLORS.length];
              return (
                <div key={i}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-white font-medium truncate max-w-40">{machine.name}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span style={{ color: 'rgba(255,255,255,0.45)' }}>{machine.count} txn</span>
                      <span className="font-semibold" style={{ color }}>₹{machine.revenue.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div
                      className="h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(pct, 4)}%`, background: color }}
                    />
                  </div>
                </div>
              );
            }) : (
              <p className="text-center py-8 text-sm" style={{ color: 'rgba(255,255,255,0.28)' }}>No machine data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Purchase by Organization */}
      <div className="rounded-2xl overflow-hidden" style={CARD}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Users className="w-4 h-4" style={{ color: '#60A5FA' }} />
            Purchase by Organization
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>Revenue breakdown by customer organization</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['Organization', 'Online', 'Coin', 'RFID', 'Total', 'Online Rev', 'Coin Rev', 'RFID Rev', 'Total Rev'].map((h, i) => (
                  <th
                    key={h}
                    className={`py-2.5 px-4 text-xs font-semibold uppercase tracking-wide ${
                      i === 0 ? 'text-left' : i < 4 ? 'text-center' : 'text-right'
                    }`}
                    style={{ color: 'rgba(255,255,255,0.35)' }}
                  >{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {organizationList.length > 0 ? organizationList.map((org, i) => {
                const orgTotal = org.onlineRevenue + org.coinRevenue + org.rfidRevenue;
                const totalPurchases = org.onlineCount + org.coinCount + org.rfidCount;
                return (
                  <tr
                    key={i}
                    className="row-hover"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <td className="py-3 px-4 font-medium text-white">{org.name}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'rgba(96,165,250,0.15)', color: '#60A5FA' }}>{org.onlineCount}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'rgba(251,191,36,0.15)', color: '#FDE68A' }}>{org.coinCount}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'rgba(167,139,250,0.15)', color: '#C4B5FD' }}>{org.rfidCount}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.60)' }}>{totalPurchases}</span>
                    </td>
                    <td className="py-3 px-4 text-right" style={{ color: '#60A5FA' }}>₹{org.onlineRevenue.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right" style={{ color: '#FBBF24' }}>₹{org.coinRevenue.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right" style={{ color: '#C4B5FD' }}>₹{org.rfidRevenue.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-bold" style={{ color: '#34D399' }}>₹{orgTotal.toFixed(2)}</td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-sm" style={{ color: 'rgba(255,255,255,0.28)' }}>No organization data available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="rounded-2xl overflow-hidden" style={CARD}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 className="font-semibold text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4" style={{ color: '#34D399' }} />
            Recent Transactions
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['Date', 'Machine', 'Product', 'Type', 'Amount', 'Status'].map((h, i) => (
                  <th
                    key={h}
                    className={`py-2.5 px-4 text-xs font-semibold uppercase tracking-wide ${
                      i < 3 ? 'text-left' : i === 3 ? 'text-center' : i === 4 ? 'text-right' : 'text-center'
                    }`}
                    style={{ color: 'rgba(255,255,255,0.35)' }}
                  >{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentCombined.length > 0 ? recentCombined.map((tx) => (
                <tr
                  key={`${tx.type}-${tx.id}`}
                  className="row-hover"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <td className="py-3 px-4" style={{ color: 'rgba(255,255,255,0.45)' }}>{new Date(tx.created_at).toLocaleDateString('en-IN')}</td>
                  <td className="py-3 px-4 font-medium text-white">{tx.machineName}</td>
                  <td className="py-3 px-4" style={{ color: 'rgba(255,255,255,0.55)' }}>{tx.productName}</td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                      style={
                        tx.type === 'online'
                          ? { background: 'rgba(96,165,250,0.15)', color: '#60A5FA' }
                          : tx.type === 'rfid'
                          ? { background: 'rgba(167,139,250,0.15)', color: '#C4B5FD' }
                          : { background: 'rgba(251,191,36,0.15)', color: '#FBBF24' }
                      }
                    >
                      {tx.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-white">₹{tx.total_amount.toFixed(2)}</td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                      style={
                        tx.payment_status === 'paid'
                          ? { background: 'rgba(52,211,153,0.15)', color: '#6EE7B7' }
                          : tx.payment_status === 'failed'
                          ? { background: 'rgba(244,63,94,0.15)', color: '#FDA4AF' }
                          : { background: 'rgba(251,191,36,0.15)', color: '#FDE68A' }
                      }
                    >
                      {tx.payment_status}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm" style={{ color: 'rgba(255,255,255,0.28)' }}>No transactions found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
