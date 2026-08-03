import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import {
  Search, IndianRupee, Calendar, User,
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, CreditCard, Coins, Nfc,
} from 'lucide-react';

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
      {sub && <p className="text-xs mt-1" style={{ color: accentColor }}>{sub}</p>}
    </div>
  );
}

export default async function TransactionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('role, account_type')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') redirect('/customer/dashboard');

  const isSuperCustomer = profile?.account_type === 'super_customer';
  let machineIds: string[] = [];
  if (isSuperCustomer) {
    const { data: machines } = await serviceSupabase
      .from('vending_machines').select('id').eq('customer_id', user.id);
    machineIds = machines?.map((m: any) => m.id) || [];
  }

  const transactionsQuery = serviceSupabase
    .from('transactions')
    .select(`*, profiles!transactions_customer_id_fkey (email), vending_machines!transactions_machine_id_fkey (name, location)`);

  const coinPaymentsQuery = serviceSupabase
    .from('coin_payments')
    .select(`*, products (name), vending_machines (name, location)`);

  const rfidPaymentsQuery = serviceSupabase
    .from('rfid_payments')
    .select(`*, products (name), vending_machines (name, location), rfid_cards (uid, holder_name)`);

  const [
    { data: transactions },
    { data: coinPayments },
    { data: rfidPayments },
  ] = await Promise.all([
    isSuperCustomer && machineIds.length > 0
      ? transactionsQuery.in('machine_id', machineIds).order('created_at', { ascending: false }).limit(50)
      : transactionsQuery.order('created_at', { ascending: false }).limit(50),
    isSuperCustomer && machineIds.length > 0
      ? coinPaymentsQuery.in('machine_id', machineIds).order('created_at', { ascending: false }).limit(50)
      : coinPaymentsQuery.order('created_at', { ascending: false }).limit(50),
    isSuperCustomer && machineIds.length > 0
      ? rfidPaymentsQuery.in('machine_id', machineIds).order('created_at', { ascending: false }).limit(50)
      : rfidPaymentsQuery.order('created_at', { ascending: false }).limit(50),
  ]);

  const onlineRevenue = transactions?.reduce((sum, tx) => sum + parseFloat(tx.total_amount || 0), 0) || 0;
  const coinRevenue = (coinPayments?.reduce((sum, tx) => sum + (tx.amount_in_paisa || 0), 0) || 0) / 100;
  const rfidRevenue = (rfidPayments?.reduce((sum, tx) => sum + (tx.amount_in_paisa || 0), 0) || 0) / 100;
  const totalRevenue = onlineRevenue + coinRevenue + rfidRevenue;
  const totalTransactionCount = (transactions?.length || 0) + (coinPayments?.length || 0) + (rfidPayments?.length || 0);
  const pendingTransactions = transactions?.filter(tx => tx.payment_status === 'pending') || [];
  const failedTransactions = transactions?.filter(tx => tx.payment_status === 'failed') || [];

  const productRevenue = new Map<string, number>();
  transactions?.forEach(tx => {
    const items = typeof tx.items === 'string' ? JSON.parse(tx.items) : tx.items || [];
    items.forEach((item: any) => {
      const productName = item.name || 'Unknown';
      productRevenue.set(productName, (productRevenue.get(productName) || 0) + parseFloat(tx.total_amount || 0));
    });
  });
  coinPayments?.forEach(tx => {
    const productName = tx.products?.name || 'Unknown';
    productRevenue.set(productName, (productRevenue.get(productName) || 0) + (tx.amount_in_paisa / 100));
  });
  rfidPayments?.forEach(tx => {
    const productName = tx.products?.name || 'Unknown';
    productRevenue.set(productName, (productRevenue.get(productName) || 0) + (tx.amount_in_paisa / 100));
  });
  const topProducts = Array.from(productRevenue.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const machineRevenue = new Map<string, number>();
  transactions?.forEach(tx => {
    const machineName = tx.vending_machines?.name || 'Unknown';
    machineRevenue.set(machineName, (machineRevenue.get(machineName) || 0) + parseFloat(tx.total_amount || 0));
  });
  coinPayments?.forEach(tx => {
    const machineName = tx.vending_machines?.name || 'Unknown';
    machineRevenue.set(machineName, (machineRevenue.get(machineName) || 0) + (tx.amount_in_paisa / 100));
  });
  rfidPayments?.forEach(tx => {
    const machineName = tx.vending_machines?.name || 'Unknown';
    machineRevenue.set(machineName, (machineRevenue.get(machineName) || 0) + (tx.amount_in_paisa / 100));
  });
  const topMachines = Array.from(machineRevenue.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return date.toISOString().split('T')[0];
  });

  const dailyRevenue = last7Days.map(date => {
    const dayOnline = transactions?.filter(tx => tx.created_at.startsWith(date) && tx.payment_status === 'paid') || [];
    const dayCoin = coinPayments?.filter(tx => tx.created_at.startsWith(date)) || [];
    const dayRfid = rfidPayments?.filter(tx => tx.created_at.startsWith(date)) || [];
    const onlineRev = dayOnline.reduce((sum, tx) => sum + parseFloat(tx.total_amount || 0), 0);
    const coinRev = dayCoin.reduce((sum, tx) => sum + (tx.amount_in_paisa / 100), 0);
    const rfidRev = dayRfid.reduce((sum, tx) => sum + (tx.amount_in_paisa / 100), 0);
    return { date, revenue: onlineRev + coinRev + rfidRev, count: dayOnline.length + dayCoin.length + dayRfid.length };
  });

  const maxDailyRevenue = Math.max(...dailyRevenue.map(d => d.revenue), 1);
  const ACCENT_COLORS = ['#F43F5E', '#A78BFA', '#34D399', '#FBBF24', '#60A5FA'];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-white">Transactions</h1>
        <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.42)' }}>Comprehensive transaction insights and trends</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign}    label="Total Revenue"     value={`₹${totalRevenue.toFixed(2)}`}     accentColor="#34D399" iconBg="rgba(52,211,153,0.18)"  sub={`${coinPayments?.length || 0} coin + ${transactions?.length || 0} online + ${rfidPayments?.length || 0} rfid`} />
        <StatCard icon={ShoppingCart}  label="Total Transactions" value={String(totalTransactionCount)}     accentColor="#60A5FA" iconBg="rgba(96,165,250,0.18)"  sub="Last 50 per type" />
        <StatCard icon={TrendingUp}    label="Pending"            value={String(pendingTransactions.length)} accentColor="#FBBF24" iconBg="rgba(251,191,36,0.18)" sub="Awaiting payment" />
        <StatCard icon={TrendingDown}  label="Failed"             value={String(failedTransactions.length)}  accentColor="#F43F5E" iconBg="rgba(244,63,94,0.18)"  sub="Failed payments" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Revenue Chart */}
        <div className="rounded-2xl p-5" style={CARD}>
          <h3 className="font-semibold text-white mb-1">Daily Revenue</h3>
          <p className="text-xs mb-5" style={{ color: 'rgba(255,255,255,0.38)' }}>Last 7 days</p>
          <div className="h-48 flex items-end justify-between gap-2">
            {dailyRevenue.map((day, i) => {
              const heightPct = (day.revenue / maxDailyRevenue) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex flex-col items-center justify-end h-40 relative group">
                    <div
                      className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity px-2.5 py-1.5 rounded-xl text-xs whitespace-nowrap z-10"
                      style={{ background: 'rgba(20,6,42,0.95)', border: '1px solid rgba(255,255,255,0.12)', color: 'white' }}
                    >
                      <div className="font-semibold">₹{day.revenue.toFixed(2)}</div>
                      <div style={{ color: 'rgba(255,255,255,0.55)' }}>{day.count} txn</div>
                    </div>
                    <div
                      className="w-full rounded-t-lg transition-all duration-500"
                      style={{
                        height: `${heightPct}%`,
                        minHeight: day.revenue > 0 ? 6 : 0,
                        background: 'linear-gradient(180deg, #F43F5E, #A78BFA)',
                        opacity: 0.85,
                      }}
                    />
                  </div>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.38)' }}>
                    {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-3 flex items-center justify-between text-xs" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.40)' }}>
            <span>Total: ₹{dailyRevenue.reduce((s, d) => s + d.revenue, 0).toFixed(2)}</span>
            <span>{dailyRevenue.reduce((s, d) => s + d.count, 0)} transactions</span>
          </div>
        </div>

        {/* Top Products */}
        <div className="rounded-2xl p-5" style={CARD}>
          <h3 className="font-semibold text-white mb-1">Top Products by Revenue</h3>
          <p className="text-xs mb-5" style={{ color: 'rgba(255,255,255,0.38)' }}>Across both payment methods</p>
          <div className="space-y-4">
            {topProducts.length > 0 ? topProducts.map(([product, revenue], i) => {
              const maxRevenue = topProducts[0]?.[1] || 1;
              const widthPct = (revenue / maxRevenue) * 100;
              const color = ACCENT_COLORS[i % ACCENT_COLORS.length];
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1.5 text-sm">
                    <span className="text-white font-medium truncate flex-1">{product}</span>
                    <span className="font-bold ml-4" style={{ color }}>₹{revenue.toFixed(2)}</span>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div
                      className="h-2 rounded-full transition-all duration-700"
                      style={{ width: `${widthPct}%`, minWidth: revenue > 0 ? 24 : 0, background: color }}
                    />
                  </div>
                </div>
              );
            }) : (
              <p className="text-center py-8 text-sm" style={{ color: 'rgba(255,255,255,0.28)' }}>No product data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Top Machines */}
      <div className="rounded-2xl p-5" style={CARD}>
        <h3 className="font-semibold text-white mb-4">Top Machines by Revenue</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {topMachines.length > 0 ? topMachines.map(([machine, revenue], i) => (
            <div
              key={i}
              className="p-4 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${ACCENT_COLORS[i % ACCENT_COLORS.length]}30` }}
            >
              <p className="text-xs mb-1" style={{ color: ACCENT_COLORS[i % ACCENT_COLORS.length] }}>#{i + 1}</p>
              <p className="font-medium text-white text-sm truncate mb-2">{machine}</p>
              <p className="text-lg font-bold" style={{ color: ACCENT_COLORS[i % ACCENT_COLORS.length] }}>₹{revenue.toFixed(2)}</p>
            </div>
          )) : (
            <p className="col-span-5 text-center py-4 text-sm" style={{ color: 'rgba(255,255,255,0.28)' }}>No machine data available</p>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.35)' }} />
        <input
          type="text"
          placeholder="Search transactions by product, machine, or customer..."
          className="w-full pl-11 pr-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#f3f4f6',
          }}
        />
      </div>

      {/* Transactions Table */}
      <div className="rounded-2xl overflow-hidden" style={CARD}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h3 className="font-semibold text-white">Recent Transactions</h3>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>Last 50 coin, online &amp; RFID payments</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['Date & Time', 'Customer', 'Product', 'Machine', 'Amount', 'Type', 'Status'].map((h, i) => (
                  <th
                    key={h}
                    className={`py-2.5 px-4 text-xs font-semibold uppercase tracking-wide ${i === 4 ? 'text-right' : i === 6 ? 'text-center' : 'text-left'}`}
                    style={{ color: 'rgba(255,255,255,0.35)' }}
                  >{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Coin Payments */}
              {coinPayments && coinPayments.map((txn: any) => (
                <tr
                  key={`coin-${txn.id}`}
                  className="row-hover"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <td className="py-3 px-4 whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      {new Date(txn.created_at).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5 text-sm">
                      <User className="w-3.5 h-3.5 shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }} />
                      <span style={{ color: 'rgba(255,255,255,0.55)' }}>Coin Payment</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-white">{txn.products?.name || 'Unknown'}</td>
                  <td className="py-3 px-4">
                    <p className="text-white">{txn.vending_machines?.name || 'Unknown'}</p>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{txn.vending_machines?.location}</p>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="font-semibold text-white flex items-center justify-end gap-0.5">
                      <IndianRupee className="w-3 h-3" />{(txn.amount_in_paisa / 100).toFixed(2)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: 'rgba(251,191,36,0.15)', color: '#FDE68A' }}>
                      <Coins className="w-3 h-3" />Coin
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'rgba(52,211,153,0.15)', color: '#6EE7B7' }}>Dispensed</span>
                  </td>
                </tr>
              ))}

              {/* Online Transactions */}
              {transactions && transactions.map((txn: any) => {
                const items = typeof txn.items === 'string' ? JSON.parse(txn.items) : txn.items || [];
                const productNames = items.map((item: any) => item.name).join(', ') || 'N/A';
                const statusStyle =
                  txn.payment_status === 'paid'    ? { background: 'rgba(52,211,153,0.15)', color: '#6EE7B7' }
                  : txn.payment_status === 'failed' ? { background: 'rgba(244,63,94,0.15)', color: '#FDA4AF' }
                  : { background: 'rgba(251,191,36,0.15)', color: '#FDE68A' };
                return (
                  <tr
                    key={`online-${txn.id}`}
                    className="row-hover"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <td className="py-3 px-4 whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.45)' }}>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        {new Date(txn.created_at).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }} />
                        <span className="text-white text-sm">{txn.profiles?.email || 'Guest'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-white">{productNames}</td>
                    <td className="py-3 px-4" style={{ color: 'rgba(255,255,255,0.55)' }}>{txn.vending_machines?.name || 'N/A'}</td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-semibold text-white flex items-center justify-end gap-0.5">
                        <IndianRupee className="w-3 h-3" />{parseFloat(txn.total_amount || 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: 'rgba(96,165,250,0.15)', color: '#93C5FD' }}>
                        <CreditCard className="w-3 h-3" />Online
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={statusStyle}>
                        {txn.payment_status || 'pending'}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {/* RFID Payments */}
              {rfidPayments && rfidPayments.map((txn: any) => (
                <tr
                  key={`rfid-${txn.id}`}
                  className="row-hover"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <td className="py-3 px-4 whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      {new Date(txn.created_at).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5 text-sm">
                      <User className="w-3.5 h-3.5 shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }} />
                      <span style={{ color: 'rgba(255,255,255,0.55)' }}>{txn.rfid_cards?.holder_name || txn.card_uid}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-white">{txn.products?.name || 'Unknown'}</td>
                  <td className="py-3 px-4">
                    <p className="text-white">{txn.vending_machines?.name || 'Unknown'}</p>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{txn.vending_machines?.location}</p>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="font-semibold text-white flex items-center justify-end gap-0.5">
                      <IndianRupee className="w-3 h-3" />{(txn.amount_in_paisa / 100).toFixed(2)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: 'rgba(167,139,250,0.15)', color: '#C4B5FD' }}>
                      <Nfc className="w-3 h-3" />RFID
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'rgba(52,211,153,0.15)', color: '#6EE7B7' }}>Dispensed</span>
                  </td>
                </tr>
              ))}

              {!transactions?.length && !coinPayments?.length && !rfidPayments?.length && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm" style={{ color: 'rgba(255,255,255,0.28)' }}>No transactions found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
