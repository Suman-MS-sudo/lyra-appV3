import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import {
  Building2, Users, TrendingUp, Receipt,
  MapPin, Clock, Activity, Coins, CreditCard, ArrowUpRight,
} from 'lucide-react';

export const revalidate = 0;

const CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
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

export default async function AdminDashboard() {
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

  if (profile?.role === 'customer') redirect('/customer/dashboard');

  const isSuperCustomer = profile?.account_type === 'super_customer';

  let machineIds: string[] = [];
  if (isSuperCustomer) {
    const { data: machines } = await serviceSupabase
      .from('vending_machines')
      .select('id')
      .eq('customer_id', user.id);
    machineIds = machines?.map((m: any) => m.id) || [];
  }

  const machinesQuery = serviceSupabase.from('vending_machines');
  const machinesSelect = isSuperCustomer
    ? machinesQuery.select('*', { count: 'exact', head: true }).eq('customer_id', user.id)
    : machinesQuery.select('*', { count: 'exact', head: true });

  const [
    { count: totalMachines },
    { count: totalUsers },
    { count: totalTransactions },
    { count: totalCoinPayments },
    { data: recentMachines },
    { data: recentTransactions },
    { data: paidTx },
    { data: coinPayments },
  ] = await Promise.all([
    machinesSelect,
    serviceSupabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
    isSuperCustomer && machineIds.length > 0
      ? serviceSupabase.from('transactions').select('*', { count: 'exact', head: true }).in('machine_id', machineIds)
      : serviceSupabase.from('transactions').select('*', { count: 'exact', head: true }),
    isSuperCustomer && machineIds.length > 0
      ? serviceSupabase.from('coin_payments').select('*', { count: 'exact', head: true }).in('machine_id', machineIds)
      : serviceSupabase.from('coin_payments').select('*', { count: 'exact', head: true }),
    isSuperCustomer
      ? serviceSupabase.from('vending_machines').select('name, location, asset_online, last_ping').eq('customer_id', user.id).order('created_at', { ascending: false }).limit(5)
      : serviceSupabase.from('vending_machines').select('name, location, asset_online, last_ping').order('created_at', { ascending: false }).limit(5),
    isSuperCustomer && machineIds.length > 0
      ? serviceSupabase.from('transactions').select('total_amount, created_at, items').in('machine_id', machineIds).order('created_at', { ascending: false }).limit(5)
      : serviceSupabase.from('transactions').select('total_amount, created_at, items').order('created_at', { ascending: false }).limit(5),
    isSuperCustomer && machineIds.length > 0
      ? serviceSupabase.from('transactions').select('total_amount').eq('payment_status', 'paid').in('machine_id', machineIds)
      : serviceSupabase.from('transactions').select('total_amount').eq('payment_status', 'paid'),
    isSuperCustomer && machineIds.length > 0
      ? serviceSupabase.from('coin_payments').select('amount_in_paisa, dispensed').in('machine_id', machineIds)
      : serviceSupabase.from('coin_payments').select('amount_in_paisa, dispensed'),
  ]);

  const machinesWithStatus = recentMachines?.map(machine => {
    if (machine.last_ping) {
      const lastPingTime = new Date(machine.last_ping).getTime();
      machine.asset_online = (Date.now() - lastPingTime) < 10 * 60 * 1000;
    } else {
      machine.asset_online = false;
    }
    return machine;
  }) || [];

  const onlineRevenue = paidTx?.reduce((s: number, tx: any) => s + parseFloat(tx.total_amount || 0), 0) || 0;
  const coinRevenue   = (coinPayments?.reduce((s: number, tx: any) => s + (tx.amount_in_paisa || 0), 0) || 0) / 100;
  const totalRevenue  = onlineRevenue + coinRevenue;
  const onlineCount   = totalTransactions || 0;
  const coinCount     = totalCoinPayments || 0;

  const formatAmount = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.42)' }}>Welcome back — here&apos;s what&apos;s happening today.</p>
        </div>
        <div
          className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-medium"
          style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', color: '#6EE7B7' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live data
        </div>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Building2}  label="Total Machines" value={String(totalMachines || 0)}  accentColor="#60A5FA" iconBg="rgba(96,165,250,0.18)"  />
        <StatCard icon={Users}      label="Active Users"   value={String(totalUsers || 0)}     accentColor="#A78BFA" iconBg="rgba(167,139,250,0.18)" />
        <StatCard icon={TrendingUp} label="Total Revenue"  value={formatAmount(totalRevenue)}  accentColor="#34D399" iconBg="rgba(52,211,153,0.18)"  sub={`${onlineCount + coinCount} transactions`} />
        <StatCard icon={Receipt}    label="Transactions"   value={String(onlineCount + coinCount)} accentColor="#F472B6" iconBg="rgba(244,63,94,0.18)" />
      </div>

      {/* Payment method breakdown */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Coins}      label="Coin Payments"   value={String(coinCount)}   accentColor="#FBBF24" iconBg="rgba(251,191,36,0.18)" sub={formatAmount(coinRevenue)} />
        <StatCard icon={CreditCard} label="Online Payments" value={String(onlineCount)} accentColor="#60A5FA" iconBg="rgba(96,165,250,0.18)"  sub={formatAmount(onlineRevenue)} />
        <StatCard icon={Activity}   label="Coin Revenue %"
          value={totalRevenue > 0 ? `${((coinRevenue / totalRevenue) * 100).toFixed(1)}%` : '0%'}
          accentColor="#FBBF24" iconBg="rgba(251,191,36,0.18)" sub="of total revenue" />
        <StatCard icon={TrendingUp} label="Online Revenue %"
          value={totalRevenue > 0 ? `${((onlineRevenue / totalRevenue) * 100).toFixed(1)}%` : '0%'}
          accentColor="#F472B6" iconBg="rgba(244,63,94,0.18)" sub="of total revenue" />
      </div>

      {/* Recent data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent machines */}
        <div className="rounded-2xl overflow-hidden" style={CARD}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Building2 className="w-4 h-4" style={{ color: '#60A5FA' }} />
              Recent Machines
            </h2>
            <a href="/admin/machines" className="text-xs font-medium flex items-center gap-1 transition-colors hover:text-white" style={{ color: '#F472B6' }}>
              View all <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
          <div>
            {machinesWithStatus.length > 0 ? machinesWithStatus.map((machine: any, i: number) => (
              <div
                key={i}
                className="row-hover flex items-center justify-between px-5 py-3.5"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white text-sm truncate">{machine.name}</p>
                  <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.38)' }}>
                    <MapPin className="w-3 h-3" />{machine.location}
                  </p>
                </div>
                <span
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ml-3"
                  style={machine.asset_online
                    ? { background: 'rgba(52,211,153,0.15)', color: '#6EE7B7' }
                    : { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.40)' }
                  }
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${machine.asset_online ? 'animate-pulse bg-emerald-400' : 'bg-gray-500'}`} />
                  {machine.asset_online ? 'Online' : 'Offline'}
                </span>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center py-14">
                <Building2 className="w-10 h-10 mb-3" style={{ color: 'rgba(255,255,255,0.15)' }} />
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.28)' }}>No machines found</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent transactions */}
        <div className="rounded-2xl overflow-hidden" style={CARD}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Receipt className="w-4 h-4" style={{ color: '#A78BFA' }} />
              Recent Transactions
            </h2>
            <a href="/admin/transactions" className="text-xs font-medium flex items-center gap-1 transition-colors hover:text-white" style={{ color: '#F472B6' }}>
              View all <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
          <div>
            {recentTransactions && recentTransactions.length > 0 ? recentTransactions.map((tx: any, i: number) => {
              const items = typeof tx.items === 'string' ? JSON.parse(tx.items) : tx.items || [];
              const productNames = items.map((item: any) => item.name).join(', ') || 'Product';
              return (
                <div
                  key={i}
                  className="row-hover flex items-center justify-between px-5 py-3.5"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm truncate">{productNames}</p>
                    <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.38)' }}>
                      <Clock className="w-3 h-3" />
                      {new Date(tx.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span
                    className="text-base font-bold ml-3"
                    style={{
                      background: 'linear-gradient(135deg, #FDA4AF, #F43F5E)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    {formatAmount(parseFloat(tx.total_amount || 0))}
                  </span>
                </div>
              );
            }) : (
              <div className="flex flex-col items-center justify-center py-14">
                <Receipt className="w-10 h-10 mb-3" style={{ color: 'rgba(255,255,255,0.15)' }} />
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.28)' }}>No transactions found</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
