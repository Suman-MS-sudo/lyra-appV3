import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { TrendingUp, CreditCard, AlertCircle, Users, Wifi, WifiOff, Coins, Activity, Nfc, Calendar, Trophy } from 'lucide-react';
import Link from 'next/link';
import MachineAssignmentPopup from '@/components/MachineAssignmentPopup';
import { PaymentDonutChart, MachineRevenueBar, RevenueAreaChart, MachineStatusBar } from '@/components/DashboardCharts';
import TransactionsTable from '@/components/TransactionsTable';
import DashboardTabs from '@/components/DashboardTabs';
import RfidCardsUsagePanel from '@/components/RfidCardsUsagePanel';

// Force dynamic rendering - never cache this page to ensure real-time status
export const revalidate = 0;

export default async function CustomerDashboard() {
  const supabase = await createClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Use service role for comprehensive queries
  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch user profile and verify role
  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // Redirect admins to admin dashboard
  if (profile?.role === 'admin') {
    redirect('/admin/dashboard');
  }

  // Check if user is super_customer for enhanced permissions
  const isSuperCustomer = profile?.account_type === 'super_customer';

  // Fetch customer's vending machines
  // Machines are assigned to organizations (customer_id stores the org UUID).
  // All users in an organization see all machines assigned to that org.
  let customerMachines: any[] | null | undefined;
  let orgUsersWithMachines: Array<{
    id: string;
    email: string;
    full_name: string | null;
    account_type: string;
    machines: any[];
    machineCount: number;
  }> = [];

  // Super customers see all org machines; regular customers see only their assigned machines
  let orgMachines: any[] | null;
  if (isSuperCustomer && profile?.organization_id) {
    const { data } = await serviceSupabase
      .from('vending_machines')
      .select('id, name, location, status, asset_online, stock_level, customer_id, last_ping, rfid_enabled')
      .eq('customer_id', profile.organization_id);
    orgMachines = data;
  } else {
    const { data } = await serviceSupabase
      .from('vending_machines')
      .select('id, name, location, status, asset_online, stock_level, customer_id, last_ping, rfid_enabled')
      .eq('customer_id', user.id);
    orgMachines = data;
  }

  customerMachines = orgMachines;

  // Super customers see org users with each user's individually assigned machines
  if (isSuperCustomer && profile?.organization_id) {
    const { data: orgUsers } = await serviceSupabase
      .from('profiles')
      .select('id, email, full_name, account_type')
      .eq('organization_id', profile.organization_id)
      .neq('id', user.id); // exclude the super customer themselves

    if (orgUsers && orgUsers.length > 0) {
      // Fetch ALL machines: org-owned + assigned to any sub-user in one query
      const subUserIds = orgUsers.map(u => u.id);
      const { data: allOrgMachines } = await serviceSupabase
        .from('vending_machines')
        .select('id, name, customer_id')
        .or(`customer_id.eq.${profile.organization_id},${subUserIds.map(id => `customer_id.eq.${id}`).join(',')}`);

      orgUsersWithMachines = orgUsers.map(orgUser => {
        const userMachines = allOrgMachines?.filter(m => m.customer_id === orgUser.id) || [];
        return {
          ...orgUser,
          machines: userMachines,
          machineCount: userMachines.length,
        };
      });
    }
  }

  const machineIds = customerMachines?.map(m => m.id) || [];

  // Recalculate online status for all machines based on last_ping (10 minute timeout)
  // This ensures customer dashboard shows accurate real-time status
  const machinesWithUpdatedStatus = customerMachines?.map(machine => {
    if (machine.last_ping) {
      const lastPingTime = new Date(machine.last_ping).getTime();
      const now = new Date().getTime();
      const tenMinutes = 10 * 60 * 1000; // 10 minutes in milliseconds
      machine.asset_online = (now - lastPingTime) < tenMinutes;
    } else {
      machine.asset_online = false;
    }
    return machine;
  }) || [];

  // Fetch all transactions, coin payments, and RFID payments for customer's machines
  const [
    { data: onlineTransactions },
    { data: coinPayments },
    { data: rfidPayments }
  ] = await Promise.all([
    serviceSupabase
      .from('transactions')
      .select(`
        id,
        total_amount,
        items,
        quantity,
        status,
        payment_status,
        payment_method,
        created_at,
        machine_id,
        vending_machines!transactions_machine_id_fkey (name, location)
      `)
      .in('machine_id', machineIds)
      .order('created_at', { ascending: false }),
    serviceSupabase
      .from('coin_payments')
      .select(`
        id,
        amount_in_paisa,
        quantity,
        dispensed,
        created_at,
        machine_id,
        products (name),
        vending_machines (name, location)
      `)
      .in('machine_id', machineIds)
      .order('created_at', { ascending: false }),
    serviceSupabase
      .from('rfid_payments')
      .select(`
        id,
        amount_in_paisa,
        dispensed,
        created_at,
        machine_id,
        card_uid,
        products (name),
        vending_machines (name, location),
        rfid_cards (holder_name)
      `)
      .in('machine_id', machineIds)
      .order('created_at', { ascending: false })
  ]);

  // Calculate comprehensive stats using real-time status
  const totalMachines = machinesWithUpdatedStatus?.length || 0;
  const onlineMachines = machinesWithUpdatedStatus?.filter(m => m.asset_online).length || 0;
  const lowStockMachines = machinesWithUpdatedStatus?.filter(m => m.stock_level !== null && m.stock_level < 5).length || 0;

  // Transaction stats
  const totalOnlineTransactions = onlineTransactions?.length || 0;
  const totalCoinTransactions = coinPayments?.length || 0;
  const totalRfidTransactions = rfidPayments?.length || 0;
  const totalTransactions = totalOnlineTransactions + totalCoinTransactions + totalRfidTransactions;

  // Revenue calculations
  const onlineRevenue = onlineTransactions?.reduce((sum, tx) => {
    if (tx.payment_status === 'paid') {
      return sum + parseFloat(tx.total_amount || 0);
    }
    return sum;
  }, 0) || 0;

  const coinRevenue = (coinPayments?.reduce((sum, tx) => sum + (tx.amount_in_paisa || 0), 0) || 0) / 100;
  const rfidRevenue = (rfidPayments?.reduce((sum, tx) => sum + (tx.amount_in_paisa || 0), 0) || 0) / 100;
  const totalRevenue = onlineRevenue + coinRevenue + rfidRevenue;

  // Machine health analysis using real-time status
  const healthyMachines = machinesWithUpdatedStatus?.filter(m => m.asset_online && (m.stock_level || 0) >= 5) || [];
  const needsAttentionMachines = machinesWithUpdatedStatus?.filter(m => {
    const isOffline = !m.asset_online;
    const isLowStock = m.stock_level !== null && m.stock_level < 5;
    return isOffline || isLowStock;
  }).map(m => ({
    ...m,
    issues: [
      !m.asset_online ? 'Offline' : null,
      m.stock_level !== null && m.stock_level < 5 ? 'Low Stock' : null
    ].filter(Boolean)
  })) || [];

  // Breakdown by payment method
  const onlineTransactionCount = onlineTransactions?.filter(tx => tx.payment_status === 'paid').length || 0;
  const coinTransactionCount = coinPayments?.length || 0;
  const rfidTransactionCount = rfidPayments?.length || 0;

  // Format date for last sync display
  const formatLastSync = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  // Machine-wise breakdown for bar chart
  const machineHealthData = customerMachines?.map(machine => {
    const machineOnlineTx = onlineTransactions?.filter(tx =>
      tx.machine_id === machine.id && tx.payment_status === 'paid'
    ) || [];
    const machineCoinTx = coinPayments?.filter(tx => tx.machine_id === machine.id) || [];
    const machineRfidTx = rfidPayments?.filter(tx => tx.machine_id === machine.id) || [];
    const machineOnlineRev = machineOnlineTx.reduce((sum, tx) => sum + parseFloat(tx.total_amount || 0), 0);
    const machineCoinRev = machineCoinTx.reduce((sum, tx) => sum + (tx.amount_in_paisa / 100), 0);
    const machineRfidRev = machineRfidTx.reduce((sum, tx) => sum + (tx.amount_in_paisa / 100), 0);
    return {
      ...machine,
      name: machine.name?.substring(0, 12) || 'Unknown',
      fullName: machine.name || 'Unknown',
      online: machine.asset_online ? 1 : 0,
      offline: machine.asset_online ? 0 : 1,
      revenue: machineOnlineRev + machineCoinRev + machineRfidRev,
      onlineRevenue: machineOnlineRev,
      coinRevenue: machineCoinRev,
      rfidRevenue: machineRfidRev,
      totalTransactions: machineOnlineTx.length + machineCoinTx.length + machineRfidTx.length,
    };
  }).sort((a, b) => b.revenue - a.revenue) || [];

  // Revenue by day (last 14 days) for area chart
  const now = new Date();
  const revenueTimeline = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (13 - i));
    const dateStr = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(d); dayEnd.setHours(23, 59, 59, 999);

    const dayOnline = onlineTransactions
      ?.filter(tx => {
        const t = new Date(tx.created_at);
        return t >= dayStart && t <= dayEnd && tx.payment_status === 'paid';
      })
      .reduce((sum, tx) => sum + parseFloat(tx.total_amount || 0), 0) || 0;

    const dayCoin = (coinPayments
      ?.filter(tx => {
        const t = new Date(tx.created_at);
        return t >= dayStart && t <= dayEnd;
      })
      .reduce((sum, tx) => sum + tx.amount_in_paisa, 0) || 0) / 100;

    const dayRfid = (rfidPayments
      ?.filter(tx => {
        const t = new Date(tx.created_at);
        return t >= dayStart && t <= dayEnd;
      })
      .reduce((sum, tx) => sum + tx.amount_in_paisa, 0) || 0) / 100;

    return { date: dateStr, online: Math.round(dayOnline * 100) / 100, coin: Math.round(dayCoin * 100) / 100, rfid: Math.round(dayRfid * 100) / 100 };
  });

  // Last 10 per type — the client component handles filtering
  const last10Online = (onlineTransactions || []).slice(0, 10).map(tx => ({
    id: tx.id,
    type: 'online' as const,
    amount: parseFloat(tx.total_amount || 0),
    status: tx.payment_status,
    machine: (tx.vending_machines as any)?.name || 'Unknown',
    items: tx.quantity || 1,
    created_at: tx.created_at,
  }));

  const last10Coin = (coinPayments || []).slice(0, 10).map(tx => ({
    id: tx.id,
    type: 'coin' as const,
    amount: (tx.amount_in_paisa || 0) / 100,
    status: tx.dispensed ? 'dispensed' : 'pending',
    machine: (tx.vending_machines as any)?.name || 'Unknown',
    product: (tx.products as any)?.name || 'Unknown',
    items: tx.quantity || 1,
    created_at: tx.created_at,
  }));

  const last10Rfid = (rfidPayments || []).slice(0, 10).map(tx => ({
    id: tx.id,
    type: 'rfid' as const,
    amount: (tx.amount_in_paisa || 0) / 100,
    status: tx.dispensed ? 'dispensed' : 'pending',
    machine: (tx.vending_machines as any)?.name || 'Unknown',
    product: (tx.products as any)?.name || 'Unknown',
    items: 1,
    created_at: tx.created_at,
  }));

  const last10Transactions = [...last10Online, ...last10Coin, ...last10Rfid]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // ══════════════════════════ RFID USAGE ANALYTICS ══════════════════════════
  // Only shown as a dashboard tab when this customer has at least one
  // RFID-enabled machine assigned to them.
  const hasRfidMachines = machinesWithUpdatedStatus.some(m => (m as any).rfid_enabled);

  // Top consumers — grouped by card (holder name if known, else UID)
  const consumerStats = new Map<string, { label: string; uid: string; count: number; amount: number; lastTap: string }>();
  rfidPayments?.forEach(tx => {
    const holder = (tx.rfid_cards as any)?.holder_name;
    const key = tx.card_uid;
    const label = holder || tx.card_uid;
    const existing = consumerStats.get(key);
    const amt = (tx.amount_in_paisa || 0) / 100;
    if (existing) {
      existing.count++;
      existing.amount += amt;
      if (new Date(tx.created_at) > new Date(existing.lastTap)) existing.lastTap = tx.created_at;
    } else {
      consumerStats.set(key, { label, uid: tx.card_uid, count: 1, amount: amt, lastTap: tx.created_at });
    }
  });
  const topConsumers = Array.from(consumerStats.values()).sort((a, b) => b.count - a.count).slice(0, 10);

  // Per-machine RFID stats + daily average (over the span from first tap to now, min 1 day)
  const rfidMachineStats = machinesWithUpdatedStatus
    .filter(m => (m as any).rfid_enabled)
    .map(machine => {
      const machineTx = rfidPayments?.filter(tx => tx.machine_id === machine.id) || [];
      const revenue = machineTx.reduce((sum, tx) => sum + (tx.amount_in_paisa || 0), 0) / 100;
      let dailyAverage = 0;
      if (machineTx.length > 0) {
        const timestamps = machineTx.map(tx => new Date(tx.created_at).getTime());
        const spanDays = Math.max(1, Math.ceil((Date.now() - Math.min(...timestamps)) / (24 * 60 * 60 * 1000)));
        dailyAverage = machineTx.length / spanDays;
      }
      return {
        id: machine.id,
        name: machine.name,
        location: machine.location,
        transactionCount: machineTx.length,
        revenue,
        dailyAverage,
      };
    })
    .sort((a, b) => b.transactionCount - a.transactionCount);

  // 14-day tap-count trend (separate from the revenue timeline above, which mixes payment types)
  const rfidDailyTrend = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (13 - i));
    const dateStr = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(d); dayEnd.setHours(23, 59, 59, 999);
    const dayTx = rfidPayments?.filter(tx => {
      const t = new Date(tx.created_at);
      return t >= dayStart && t <= dayEnd;
    }) || [];
    return { date: dateStr, count: dayTx.length };
  });

  const rfidActiveDays = new Set(rfidPayments?.map(tx => new Date(tx.created_at).toDateString())).size;
  const rfidOverallDailyAverage = rfidActiveDays > 0 ? (rfidPayments?.length || 0) / rfidActiveDays : 0;
  const uniqueCardCount = consumerStats.size;

  // Actual card records (not just tap history) for the Wallet / No Limit
  // management sub-tabs, so balances can be adjusted right from here.
  // Includes org-wide ("any machine") cards, which have machine_id = NULL and
  // so wouldn't match a plain .in(machine_id) filter.
  const rfidMachineIds = machinesWithUpdatedStatus.filter(m => (m as any).rfid_enabled).map(m => m.id);
  const rfidCardFilters: string[] = [];
  if (rfidMachineIds.length > 0) rfidCardFilters.push(`machine_id.in.(${rfidMachineIds.join(',')})`);
  if (profile?.organization_id) rfidCardFilters.push(`and(machine_id.is.null,organization_id.eq.${profile.organization_id})`);

  const { data: rfidCardRecords } = rfidCardFilters.length > 0
    ? await serviceSupabase
        .from('rfid_cards')
        .select(`
          id, uid, holder_name, credits_remaining, is_active, card_type, vend_count, total_spent_paisa,
          machine_id, created_at,
          machine:vending_machines ( id, name, location )
        `)
        .or(rfidCardFilters.join(','))
        .order('created_at', { ascending: false })
    : { data: [] };

  // Pending invoices for the banner
  const { data: pendingInvoices } = await serviceSupabase
    .from('organization_invoices')
    .select('id, invoice_number, total_amount_paisa, period_end')
    .eq('organization_id', profile?.organization_id)
    .in('status', ['pending'])
    .gt('total_amount_paisa', 0)
    .order('period_end', { ascending: true });

  const totalPendingAmount = pendingInvoices?.reduce((sum, inv) => sum + inv.total_amount_paisa, 0) || 0;
  const overdueInvoices = pendingInvoices?.filter(inv => {
    const dueDate = new Date(inv.period_end);
    dueDate.setDate(dueDate.getDate() + 30);
    return dueDate < new Date();
  }) || [];

  // Helpers
  const formatAmount = (amount: number) =>
    amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const CARD: React.CSSProperties = {
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 20,
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

      {/* Invoice Banner */}
      {isSuperCustomer && totalPendingAmount > 0 && (
        <div
          className="rounded-2xl px-4 py-3 flex items-center justify-between gap-4"
          style={overdueInvoices.length > 0
            ? { background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.28)', color: '#FCA5A5' }
            : { background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.28)', color: '#FDE68A' }
          }
        >
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              {overdueInvoices.length > 0
                ? `${overdueInvoices.length} overdue invoice${overdueInvoices.length > 1 ? 's' : ''} — `
                : `${pendingInvoices?.length} pending invoice${(pendingInvoices?.length || 0) > 1 ? 's' : ''} — `}
              <strong>₹{(totalPendingAmount / 100).toFixed(2)}</strong> due
            </span>
          </div>
          <Link
            href="/customer/billing"
            className="text-xs font-semibold px-3 py-1.5 rounded-xl transition-opacity hover:opacity-80 whitespace-nowrap"
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', color: 'white' }}
          >
            View &amp; Pay →
          </Link>
        </div>
      )}

      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.42)' }}>Real-time overview of your vending machine network</p>
        </div>
        <div
          className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-medium"
          style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', color: '#6EE7B7' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live
        </div>
      </div>

      <DashboardTabs
        overview={
      <>
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Revenue',    value: `₹${formatAmount(totalRevenue)}`,  sub: `${onlineTransactionCount + coinTransactionCount + rfidTransactionCount} transactions`, icon: TrendingUp, color: '#34D399', bg: 'rgba(52,211,153,0.18)'   },
          { label: 'Online Payments',  value: `₹${formatAmount(onlineRevenue)}`, sub: `${onlineTransactionCount} paid`,                                icon: CreditCard, color: '#A78BFA', bg: 'rgba(167,139,250,0.18)'  },
          { label: 'Coin Payments',    value: `₹${formatAmount(coinRevenue)}`,   sub: `${coinTransactionCount} collections`,                            icon: Coins,      color: '#FBBF24', bg: 'rgba(251,191,36,0.18)'   },
          { label: 'RFID Payments',    value: `₹${formatAmount(rfidRevenue)}`,   sub: `${rfidTransactionCount} taps`,                                   icon: Nfc,        color: '#F472B6', bg: 'rgba(244,63,94,0.18)'    },
          { label: 'Machines Online',  value: `${onlineMachines} / ${totalMachines}`, sub: needsAttentionMachines.length > 0 ? `${needsAttentionMachines.length} need attention` : 'All healthy', icon: Wifi, color: '#60A5FA', bg: 'rgba(96,165,250,0.18)' },
        ].map(({ label, value, sub, icon: Icon, color, bg }) => (
          <div key={label} className="rounded-2xl p-5 relative overflow-hidden" style={CARD}>
            <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-full" style={{ background: bg, opacity: 0.4 }} />
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: bg }}>
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'rgba(255,255,255,0.40)' }}>{label}</p>
            <p className="text-xl font-bold text-white">{value}</p>
            <p className="text-xs mt-1 font-medium" style={{ color }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl p-5" style={CARD}>
          <h2 className="font-semibold text-white mb-0.5">Revenue Trend</h2>
          <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.40)' }}>Last 14 days — online vs coin vs RFID</p>
          <RevenueAreaChart revenueTimeline={revenueTimeline} />
        </div>

        <div className="rounded-2xl p-5" style={CARD}>
          <h2 className="font-semibold text-white mb-0.5">Payment Split</h2>
          <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.40)' }}>Revenue by payment type</p>
          <PaymentDonutChart
            onlineRevenue={onlineRevenue}
            coinRevenue={coinRevenue}
            rfidRevenue={rfidRevenue}
            onlineCount={onlineTransactionCount}
            coinCount={coinTransactionCount}
            rfidCount={rfidTransactionCount}
          />
          <div className="flex flex-col gap-2 mt-3">
            {[
              { label: 'Online', color: '#F43F5E', amount: onlineRevenue },
              { label: 'Coin',   color: '#FBBF24', amount: coinRevenue   },
              { label: 'RFID',   color: '#A78BFA', amount: rfidRevenue  },
            ].map(({ label, color, amount }) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.60)' }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  {label}
                </span>
                <span className="font-semibold text-white">₹{formatAmount(amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Machine Revenue + Health */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl p-5" style={CARD}>
          <h2 className="font-semibold text-white mb-0.5">Revenue by Machine</h2>
          <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.40)' }}>Top {Math.min(machineHealthData.length, 8)} by total revenue</p>
          <MachineRevenueBar machineHealthData={machineHealthData} />
        </div>

        <div className="rounded-2xl p-5" style={CARD}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-white">Machine Health</h2>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.40)' }}>Real-time connectivity</p>
            </div>
            <Link href="/customer/machines" className="text-xs font-medium transition-colors hover:text-white" style={{ color: '#F472B6' }}>
              View all →
            </Link>
          </div>
          <MachineStatusBar online={onlineMachines} offline={totalMachines - onlineMachines} total={totalMachines} />
          <div className="mt-4 space-y-0 max-h-48 overflow-y-auto">
            {machinesWithUpdatedStatus.map(m => (
              <div key={m.id} className="flex items-center justify-between py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex items-center gap-2 min-w-0">
                  {m.asset_online
                    ? <Wifi className="w-3.5 h-3.5 shrink-0" style={{ color: '#34D399' }} />
                    : <WifiOff className="w-3.5 h-3.5 shrink-0" style={{ color: '#F87171' }} />}
                  <span className="text-sm font-medium text-white truncate">{m.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{formatLastSync(m.last_ping)}</span>
                  {m.stock_level !== null && m.stock_level < 5 && (
                    <span className="px-1.5 py-0.5 rounded text-xs font-semibold" style={{ background: 'rgba(251,191,36,0.18)', color: '#FDE68A' }}>Low</span>
                  )}
                </div>
              </div>
            ))}
            {machinesWithUpdatedStatus.length === 0 && (
              <p className="text-sm text-center py-4" style={{ color: 'rgba(255,255,255,0.28)' }}>No machines assigned</p>
            )}
          </div>
        </div>
      </div>

      {/* Transactions */}
      <TransactionsTable transactions={last10Transactions} />

      {/* Team & Machine Access (super customer only) */}
      {isSuperCustomer && orgUsersWithMachines.length > 0 && (
        <div className="rounded-2xl p-5" style={CARD}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-white">Team &amp; Machine Access</h2>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.40)' }}>Users in your organization</p>
            </div>
            <Link
              href="/customer/users"
              className="px-3 py-1.5 text-xs font-semibold text-white rounded-xl transition-all active:scale-[0.97]"
              style={{ background: 'linear-gradient(135deg, #F43F5E, #EC4899)', boxShadow: '0 4px 14px rgba(244,63,94,0.30)' }}
            >
              Manage Users
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  {['User', 'Email', 'Role', 'Machines', 'Devices', 'Actions'].map((h, i) => (
                    <th
                      key={h}
                      className={`py-2 px-3 text-xs font-semibold uppercase tracking-wide ${i === 1 ? 'text-left hidden sm:table-cell' : i === 2 || i === 3 ? 'text-center' : i === 5 ? 'text-right' : 'text-left'}`}
                      style={{ color: 'rgba(255,255,255,0.35)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orgUsersWithMachines.map(orgUser => (
                  <tr
                    key={orgUser.id}
                    className="row-hover"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white font-semibold text-xs shrink-0"
                          style={{ background: 'linear-gradient(135deg, #F43F5E, #A78BFA)' }}
                        >
                          {(orgUser.full_name || orgUser.email || 'U').charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-white truncate max-w-24">{orgUser.full_name || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 hidden sm:table-cell" style={{ color: 'rgba(255,255,255,0.45)' }}>{orgUser.email}</td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={orgUser.account_type === 'super_customer'
                          ? { background: 'rgba(167,139,250,0.18)', color: '#C4B5FD' }
                          : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.50)' }
                        }
                      >
                        {orgUser.account_type === 'super_customer' ? 'Admin' : 'Member'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold"
                        style={{ background: 'rgba(96,165,250,0.18)', color: '#93C5FD' }}
                      >
                        {orgUser.machineCount}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <MachineAssignmentPopup machines={orgUser.machines} userName={orgUser.full_name || orgUser.email} />
                    </td>
                    <td className="py-3 px-3 text-right">
                      {orgUser.account_type !== 'super_customer' && (
                        <Link href={`/customer/users/${orgUser.id}/edit`} className="text-xs font-medium hover:text-white transition-colors" style={{ color: '#F472B6' }}>
                          Edit →
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Machines needing attention */}
      {needsAttentionMachines.length > 0 && (
        <div className="rounded-2xl p-5" style={CARD}>
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5" style={{ color: '#F87171' }} />
            <h2 className="font-semibold text-white">Machines Needing Attention</h2>
            <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: 'rgba(239,68,68,0.18)', color: '#FCA5A5' }}>
              {needsAttentionMachines.length}
            </span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {needsAttentionMachines.map(m => (
              <div
                key={m.id}
                className="rounded-xl p-4"
                style={!m.asset_online
                  ? { background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)' }
                  : { background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.25)' }
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-white text-sm">{m.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{m.location}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {(m.issues as string[]).map((issue: string) => (
                      <span
                        key={issue}
                        className="px-2 py-0.5 rounded text-xs font-semibold"
                        style={issue === 'Offline'
                          ? { background: 'rgba(239,68,68,0.25)', color: '#FCA5A5' }
                          : { background: 'rgba(251,191,36,0.25)', color: '#FDE68A' }
                        }
                      >
                        {issue}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Last seen: {formatLastSync(m.last_ping)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
      </>
        }
        rfid={hasRfidMachines ? (
          <>
            {/* RFID KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total RFID Taps',   value: String(rfidTransactionCount),           sub: `across ${rfidMachineStats.length} machine${rfidMachineStats.length !== 1 ? 's' : ''}`, icon: Nfc,       color: '#A78BFA', bg: 'rgba(167,139,250,0.18)' },
                { label: 'Total RFID Revenue', value: `₹${formatAmount(rfidRevenue)}`,         sub: 'all-time',                                                                              icon: TrendingUp, color: '#34D399', bg: 'rgba(52,211,153,0.18)' },
                { label: 'Unique Cards Used',  value: String(uniqueCardCount),                 sub: 'distinct RFID cards',                                                                   icon: Users,      color: '#60A5FA', bg: 'rgba(96,165,250,0.18)' },
                { label: 'Daily Average',      value: rfidOverallDailyAverage.toFixed(1),       sub: 'taps per active day',                                                                   icon: Calendar,   color: '#FBBF24', bg: 'rgba(251,191,36,0.18)' },
              ].map(({ label, value, sub, icon: Icon, color, bg }) => (
                <div key={label} className="rounded-2xl p-5 relative overflow-hidden" style={CARD}>
                  <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-full" style={{ background: bg, opacity: 0.4 }} />
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: bg }}>
                    <Icon className="w-4 h-4" style={{ color }} />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'rgba(255,255,255,0.40)' }}>{label}</p>
                  <p className="text-xl font-bold text-white">{value}</p>
                  <p className="text-xs mt-1 font-medium" style={{ color }}>{sub}</p>
                </div>
              ))}
            </div>

            {/* Card holders — wallet / no-limit sub-tabs with balance controls */}
            <RfidCardsUsagePanel initialCards={(rfidCardRecords as any) || []} />

            {/* 14-day tap trend */}
            <div className="rounded-2xl p-5" style={CARD}>
              <h2 className="font-semibold text-white mb-0.5">Tap Activity</h2>
              <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.40)' }}>Last 14 days — RFID taps per day</p>
              <div className="flex items-end gap-1.5 h-32">
                {(() => {
                  const max = Math.max(...rfidDailyTrend.map(d => d.count), 1);
                  return rfidDailyTrend.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                      <span className="text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#C4B5FD' }}>{d.count}</span>
                      <div
                        className="w-full rounded-t-md transition-all"
                        style={{
                          height: `${Math.max((d.count / max) * 100, d.count > 0 ? 6 : 2)}%`,
                          background: d.count > 0 ? 'linear-gradient(180deg, #A78BFA, #7C3AED)' : 'rgba(255,255,255,0.06)',
                        }}
                      />
                      <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.30)' }}>{d.date.split(' ')[1]}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              {/* Top consumers */}
              <div className="rounded-2xl p-5" style={CARD}>
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="w-4 h-4" style={{ color: '#FBBF24' }} />
                  <h2 className="font-semibold text-white">Top Consumers</h2>
                </div>
                {topConsumers.length > 0 ? (
                  <div className="space-y-0 max-h-80 overflow-y-auto">
                    {topConsumers.map((c, i) => (
                      <div key={c.label + i} className="flex items-center justify-between py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                            style={i === 0
                              ? { background: 'rgba(251,191,36,0.20)', color: '#FDE68A' }
                              : { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.50)' }}
                          >
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">{c.label}</p>
                            {c.label !== c.uid && (
                              <p className="text-xs font-mono truncate" style={{ color: 'rgba(255,255,255,0.30)' }}>{c.uid}</p>
                            )}
                            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Last tap {formatTimeAgo(c.lastTap)}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <p className="text-sm font-bold text-white">{c.count} taps</p>
                          <p className="text-xs" style={{ color: '#C4B5FD' }}>₹{formatAmount(c.amount)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-center py-8" style={{ color: 'rgba(255,255,255,0.28)' }}>No RFID taps recorded yet</p>
                )}
              </div>

              {/* Per-machine RFID breakdown */}
              <div className="rounded-2xl p-5" style={CARD}>
                <h2 className="font-semibold text-white mb-0.5">By Machine</h2>
                <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.40)' }}>Taps, revenue &amp; daily average per machine</p>
                {rfidMachineStats.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                          <th className="text-left py-2 px-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>Machine</th>
                          <th className="text-right py-2 px-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>Taps</th>
                          <th className="text-right py-2 px-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>Revenue</th>
                          <th className="text-right py-2 px-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>Avg/Day</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rfidMachineStats.map(m => (
                          <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td className="py-2.5 px-2">
                              <p className="font-medium text-white truncate max-w-32">{m.name}</p>
                              <p className="text-xs truncate max-w-32" style={{ color: 'rgba(255,255,255,0.35)' }}>{m.location}</p>
                            </td>
                            <td className="py-2.5 px-2 text-right font-semibold text-white">{m.transactionCount}</td>
                            <td className="py-2.5 px-2 text-right" style={{ color: '#C4B5FD' }}>₹{formatAmount(m.revenue)}</td>
                            <td className="py-2.5 px-2 text-right" style={{ color: 'rgba(255,255,255,0.55)' }}>{m.dailyAverage.toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-center py-8" style={{ color: 'rgba(255,255,255,0.28)' }}>No RFID-enabled machines with activity yet</p>
                )}
              </div>
            </div>
          </>
        ) : undefined}
      />
    </main>
  );
}
