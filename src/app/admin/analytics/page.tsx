import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { TrendingUp, ShoppingCart, Users, DollarSign, Activity, Building2 } from 'lucide-react';
import { AreaChart, BarList, PageHeader, Panel, Radar, RingStat, StatTile, dailySeries, inr, type Tone } from '@/components/ui/kit';

// Start of the 14-day window (module-level so the component body stays pure)
const sinceIso = () => Date.now() - 14 * 86_400_000;

export const revalidate = 0;

const CARD: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 20,
  boxShadow: 'var(--shadow-card)',
};

function StatCard({
  icon, label, value, sub, accentColor,
}: {
  icon: React.ElementType; label: string; value: string; sub?: string;
  accentColor: string; iconBg?: string;
}) {
  const tone: Tone = accentColor.includes('success') ? 'mint' : accentColor.includes('warning') ? 'butter' : accentColor.includes('muted') ? 'lilac' : 'sky';
  return <StatTile tone={tone} icon={icon} label={label} value={value} sub={sub} />;
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

  // Last 14 days of amounts for the trend chart and payment mix
  const since = new Date(sinceIso()).toISOString();
  const [{ data: trendOnline }, { data: trendCoin }, { data: trendRfid }] = await Promise.all([
    serviceSupabase.from('transactions').select('created_at, total_amount').eq('payment_status', 'paid').gte('created_at', since),
    serviceSupabase.from('coin_payments').select('created_at, amount_in_paisa').gte('created_at', since),
    serviceSupabase.from('rfid_payments').select('created_at, amount_in_paisa').gte('created_at', since),
  ]);
  const onlineTrendRows = (trendOnline || []).map((r: { created_at: string; total_amount: string | number }) => ({ at: r.created_at, amount: Number(r.total_amount) || 0 }));
  const coinTrendRows = (trendCoin || []).map((r: { created_at: string; amount_in_paisa: number }) => ({ at: r.created_at, amount: (r.amount_in_paisa || 0) / 100 }));
  const rfidTrendRows = (trendRfid || []).map((r: { created_at: string; amount_in_paisa: number }) => ({ at: r.created_at, amount: (r.amount_in_paisa || 0) / 100 }));
  const trend = dailySeries([...onlineTrendRows, ...coinTrendRows, ...rfidTrendRows], 14);
  const sum = (rows: { amount: number }[]) => rows.reduce((t, r) => t + r.amount, 0);
  const mixOnline = sum(onlineTrendRows), mixCoin = sum(coinTrendRows), mixRfid = sum(rfidTrendRows);
  const mixTotal = mixOnline + mixCoin + mixRfid;
  // Busiest weekdays (IST) over the same 14 days
  const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const byWeekday = WEEK.map((label) => ({ label, value: 0 }));
  for (const r of [...onlineTrendRows, ...coinTrendRows, ...rfidTrendRows]) {
    byWeekday[(new Date(new Date(r.at).getTime() + 5.5 * 3_600_000).getUTCDay() + 6) % 7].value += r.amount;
  }

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


  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <PageHeader
        eyebrow="Insights"
        title="Analytics"
        subtitle="Revenue trends, payment mix and performance across every organization"
        actions={<span className="db-live"><span className="db-live-dot" />Live data</span>}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 ui-statrow">
        <StatCard icon={DollarSign} label="Total Revenue" value={`₹${totalRevenue.toFixed(2)}`} accentColor="var(--success)" iconBg="rgba(29,122,60,0.12)"
          sub={`₹${onlineRevenue.toFixed(2)} online + ₹${coinRevenue.toFixed(2)} coin + ₹${rfidRevenue.toFixed(2)} rfid`} />
        <StatCard icon={ShoppingCart} label="Transactions" value={String((totalTransactions || 0) + (totalCoinPayments || 0) + (totalRfidPayments || 0))} accentColor="var(--accent)" iconBg="var(--accent-soft)"
          sub={`${totalTransactions || 0} online · ${totalCoinPayments || 0} coin · ${totalRfidPayments || 0} rfid`} />
        <StatCard icon={Activity} label="Total Machines" value={String(totalMachines || 0)} accentColor="var(--muted)" iconBg="rgba(0,0,0,0.04)"
          sub={`${organizationMachineList.length} organizations`} />
        <StatCard icon={Building2} label="Organizations" value={String(totalCustomers || 0)} accentColor="var(--warning)" iconBg="rgba(154,100,0,0.12)"
          sub="Customer organizations" />
      </div>

      {/* 14-day revenue trend + payment mix */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-5">
        <Panel title="Revenue — last 14 days">
          <AreaChart points={trend} format={(n) => inr(n)} />
        </Panel>
        <Panel title="Busiest days">
          <Radar axes={byWeekday} />
          <p className="text-xs text-center text-[var(--muted)] -mt-1">Revenue by weekday · last 14 days</p>
        </Panel>
      </div>

      {/* Payment mix as ring statistics (reference "Statistics") */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <RingStat label="UPI / Online" sub={inr(mixOnline)} value={Math.round(mixOnline)} max={Math.max(Math.round(mixTotal), 1)} />
        <RingStat label="Coin" sub={inr(mixCoin)} value={Math.round(mixCoin)} max={Math.max(Math.round(mixTotal), 1)} tone="warn" />
        <RingStat label="RFID" sub={inr(mixRfid)} value={Math.round(mixRfid)} max={Math.max(Math.round(mixTotal), 1)} tone="bad" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Panel title="Machines by organization">
          <BarList items={organizationMachineList.map((o) => ({ label: o.name, value: o.count }))} format={(n) => `${n} machine${n === 1 ? '' : 's'}`} />
        </Panel>
        <Panel title="Top products">
          <BarList items={topProductsList.map((p) => ({ label: p.name, value: p.revenue, sub: `${p.count} sales` }))} format={(n) => inr(n, 2)} />
        </Panel>
        <Panel title="Machine performance">
          <BarList
            items={[...machineRevenue].sort((x: any, y: any) => y.revenue - x.revenue).slice(0, 10).map((m: any) => ({ label: m.name, value: m.revenue, sub: `${m.count} txn` }))}
            format={(n) => inr(n, 2)}
          />
        </Panel>
      </div>

      {/* Purchase by Organization */}
      <div className="rounded-2xl overflow-hidden" style={CARD}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--surface-2)' }}>
          <h2 className="font-semibold text-[var(--fg)] flex items-center gap-2">
            <Users className="w-4 h-4" style={{ color: 'var(--accent-ink)' }} />
            Purchase by Organization
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>Revenue breakdown by customer organization</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--surface-2)' }}>
                {['Organization', 'Online', 'Coin', 'RFID', 'Total', 'Online Rev', 'Coin Rev', 'RFID Rev', 'Total Rev'].map((h, i) => (
                  <th
                    key={h}
                    className={`py-2.5 px-4 text-xs font-semibold uppercase tracking-wide ${
                      i === 0 ? 'text-left' : i < 4 ? 'text-center' : 'text-right'
                    }`}
                    style={{ color: 'var(--subtle)' }}
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
                    style={{ borderBottom: '1px solid var(--surface-2)' }}
                  >
                    <td className="py-3 px-4 font-medium text-[var(--fg)]">{org.name}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)' }}>{org.onlineCount}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'rgba(154,100,0,0.12)', color: 'var(--warning)' }}>{org.coinCount}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'rgba(0,0,0,0.04)', color: 'var(--muted)' }}>{org.rfidCount}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'var(--surface-2)', color: 'var(--fg-2)' }}>{totalPurchases}</span>
                    </td>
                    <td className="py-3 px-4 text-right" style={{ color: 'var(--accent-ink)' }}>₹{org.onlineRevenue.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right" style={{ color: 'var(--warning)' }}>₹{org.coinRevenue.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right" style={{ color: 'var(--muted)' }}>₹{org.rfidRevenue.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-bold" style={{ color: 'var(--success)' }}>₹{orgTotal.toFixed(2)}</td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-sm" style={{ color: 'var(--subtle)' }}>No organization data available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="rounded-2xl overflow-hidden" style={CARD}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--surface-2)' }}>
          <h2 className="font-semibold text-[var(--fg)] flex items-center gap-2">
            <TrendingUp className="w-4 h-4" style={{ color: 'var(--success)' }} />
            Recent Transactions
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--surface-2)' }}>
                {['Date', 'Machine', 'Product', 'Type', 'Amount', 'Status'].map((h, i) => (
                  <th
                    key={h}
                    className={`py-2.5 px-4 text-xs font-semibold uppercase tracking-wide ${
                      i < 3 ? 'text-left' : i === 3 ? 'text-center' : i === 4 ? 'text-right' : 'text-center'
                    }`}
                    style={{ color: 'var(--subtle)' }}
                  >{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentCombined.length > 0 ? recentCombined.map((tx) => (
                <tr
                  key={`${tx.type}-${tx.id}`}
                  className="row-hover"
                  style={{ borderBottom: '1px solid var(--surface-2)' }}
                >
                  <td className="py-3 px-4" style={{ color: 'var(--muted)' }}>{new Date(tx.created_at).toLocaleDateString('en-IN')}</td>
                  <td className="py-3 px-4 font-medium text-[var(--fg)]">{tx.machineName}</td>
                  <td className="py-3 px-4" style={{ color: 'var(--muted)' }}>{tx.productName}</td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                      style={
                        tx.type === 'online'
                          ? { background: 'var(--accent-soft)', color: 'var(--accent-ink)' }
                          : tx.type === 'rfid'
                          ? { background: 'rgba(0,0,0,0.04)', color: 'var(--muted)' }
                          : { background: 'rgba(154,100,0,0.12)', color: 'var(--warning)' }
                      }
                    >
                      {tx.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-[var(--fg)]">₹{tx.total_amount.toFixed(2)}</td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                      style={
                        tx.payment_status === 'paid'
                          ? { background: 'rgba(29,122,60,0.12)', color: 'var(--success)' }
                          : tx.payment_status === 'failed'
                          ? { background: 'rgba(0,0,0,0.04)', color: 'var(--accent-ink)' }
                          : { background: 'rgba(154,100,0,0.12)', color: 'var(--warning)' }
                      }
                    >
                      {tx.payment_status}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm" style={{ color: 'var(--subtle)' }}>No transactions found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
