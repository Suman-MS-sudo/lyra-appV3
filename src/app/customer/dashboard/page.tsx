import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { TrendingUp, CreditCard, AlertCircle, Users, Wifi, WifiOff, Coins, Activity } from 'lucide-react';
import Link from 'next/link';
import MachineAssignmentPopup from '@/components/MachineAssignmentPopup';
import { PaymentDonutChart, MachineRevenueBar, RevenueAreaChart, MachineStatusBar } from '@/components/DashboardCharts';
import TransactionsTable from '@/components/TransactionsTable';

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
      .select('id, name, location, status, asset_online, stock_level, customer_id, last_ping')
      .eq('customer_id', profile.organization_id);
    orgMachines = data;
  } else {
    const { data } = await serviceSupabase
      .from('vending_machines')
      .select('id, name, location, status, asset_online, stock_level, customer_id, last_ping')
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

  // Fetch all transactions and coin payments for customer's machines
  const [
    { data: onlineTransactions },
    { data: coinPayments }
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
      .order('created_at', { ascending: false })
  ]);

  // Calculate comprehensive stats using real-time status
  const totalMachines = machinesWithUpdatedStatus?.length || 0;
  const onlineMachines = machinesWithUpdatedStatus?.filter(m => m.asset_online).length || 0;
  const lowStockMachines = machinesWithUpdatedStatus?.filter(m => m.stock_level !== null && m.stock_level < 5).length || 0;

  // Transaction stats
  const totalOnlineTransactions = onlineTransactions?.length || 0;
  const totalCoinTransactions = coinPayments?.length || 0;
  const totalTransactions = totalOnlineTransactions + totalCoinTransactions;

  // Revenue calculations
  const onlineRevenue = onlineTransactions?.reduce((sum, tx) => {
    if (tx.payment_status === 'paid') {
      return sum + parseFloat(tx.total_amount || 0);
    }
    return sum;
  }, 0) || 0;

  const coinRevenue = (coinPayments?.reduce((sum, tx) => sum + (tx.amount_in_paisa || 0), 0) || 0) / 100;
  const totalRevenue = onlineRevenue + coinRevenue;

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
    const machineOnlineRev = machineOnlineTx.reduce((sum, tx) => sum + parseFloat(tx.total_amount || 0), 0);
    const machineCoinRev = machineCoinTx.reduce((sum, tx) => sum + (tx.amount_in_paisa / 100), 0);
    return {
      ...machine,
      name: machine.name?.substring(0, 12) || 'Unknown',
      fullName: machine.name || 'Unknown',
      online: machine.asset_online ? 1 : 0,
      offline: machine.asset_online ? 0 : 1,
      revenue: machineOnlineRev + machineCoinRev,
      onlineRevenue: machineOnlineRev,
      coinRevenue: machineCoinRev,
      totalTransactions: machineOnlineTx.length + machineCoinTx.length,
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

    return { date: dateStr, online: Math.round(dayOnline * 100) / 100, coin: Math.round(dayCoin * 100) / 100 };
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

  const last10Transactions = [...last10Online, ...last10Coin]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

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

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Invoice Banner */}
      {isSuperCustomer && totalPendingAmount > 0 && (
        <div className={`rounded-xl border px-4 py-3 flex items-center justify-between gap-4 ${
          overdueInvoices.length > 0
            ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
            : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
        }`}>
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
            className="text-xs font-semibold px-3 py-1.5 bg-white dark:bg-gray-800 border border-current/20 rounded-lg hover:opacity-80 transition-opacity whitespace-nowrap"
          >
            View &amp; Pay →
          </Link>
        </div>
      )}

      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Real-time overview of your vending machine network</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 rounded-bl-full" />
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Revenue</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">₹{formatAmount(totalRevenue)}</p>
          <div className="flex items-center gap-1 mt-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
            <TrendingUp className="w-3.5 h-3.5" />
            {(onlineTransactionCount + coinTransactionCount)} transactions
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-purple-50 dark:bg-purple-900/20 rounded-bl-full" />
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Online Payments</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">₹{formatAmount(onlineRevenue)}</p>
          <div className="flex items-center gap-1 mt-2 text-xs text-purple-600 dark:text-purple-400 font-medium">
            <CreditCard className="w-3.5 h-3.5" />
            {onlineTransactionCount} paid
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-amber-50 dark:bg-amber-900/20 rounded-bl-full" />
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Coin Payments</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">₹{formatAmount(coinRevenue)}</p>
          <div className="flex items-center gap-1 mt-2 text-xs text-amber-600 dark:text-amber-400 font-medium">
            <Coins className="w-3.5 h-3.5" />
            {coinTransactionCount} collections
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 rounded-bl-full" />
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Machines Online</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{onlineMachines} <span className="text-gray-400 dark:text-gray-600 text-base font-normal">/ {totalMachines}</span></p>
          <div className="flex items-center gap-1 mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <Wifi className="w-3.5 h-3.5" />
            {needsAttentionMachines.length > 0 ? `${needsAttentionMachines.length} need attention` : 'All healthy'}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="mb-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Revenue Trend</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Last 14 days — online vs coin</p>
          </div>
          <RevenueAreaChart revenueTimeline={revenueTimeline} />
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Payment Split</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Revenue by payment type</p>
          <PaymentDonutChart
            onlineRevenue={onlineRevenue}
            coinRevenue={coinRevenue}
            onlineCount={onlineTransactionCount}
            coinCount={coinTransactionCount}
          />
          <div className="flex flex-col gap-2 mt-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300"><span className="w-3 h-3 rounded-full bg-indigo-500 inline-block" />Online</span>
              <span className="font-medium text-gray-900 dark:text-white">₹{formatAmount(onlineRevenue)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />Coin</span>
              <span className="font-medium text-gray-900 dark:text-white">₹{formatAmount(coinRevenue)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Machine Revenue + Status */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Revenue by Machine</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Top {Math.min(machineHealthData.length, 8)} by total revenue</p>
          <MachineRevenueBar machineHealthData={machineHealthData} />
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">Machine Health</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Real-time connectivity</p>
            </div>
            <Link href="/customer/machines" className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline">View all →</Link>
          </div>
          <MachineStatusBar online={onlineMachines} offline={totalMachines - onlineMachines} total={totalMachines} />
          <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
            {machinesWithUpdatedStatus.map(m => (
              <div key={m.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  {m.asset_online
                    ? <Wifi className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    : <WifiOff className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{m.name}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 shrink-0">
                  <span>{formatLastSync(m.last_ping)}</span>
                  {m.stock_level !== null && m.stock_level < 5 && (
                    <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded font-medium">Low</span>
                  )}
                </div>
              </div>
            ))}
            {machinesWithUpdatedStatus.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No machines assigned</p>
            )}
          </div>
        </div>
      </div>

      {/* Transactions */}
      <TransactionsTable transactions={last10Transactions} />

      {/* Team & Machine Access (super customer only) */}
      {isSuperCustomer && orgUsersWithMachines.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">Team &amp; Machine Access</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Users in your organization</p>
            </div>
            <Link href="/customer/users" className="px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 rounded-lg transition-all">Manage Users</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">User</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden sm:table-cell">Email</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Role</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Machines</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Devices</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orgUsersWithMachines.map(orgUser => (
                  <tr key={orgUser.id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-xs shrink-0">
                          {(orgUser.full_name || orgUser.email || 'U').charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-900 dark:text-white truncate max-w-[100px]">{orgUser.full_name || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-gray-500 dark:text-gray-400 hidden sm:table-cell">{orgUser.email}</td>
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${orgUser.account_type === 'super_customer' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
                        {orgUser.account_type === 'super_customer' ? 'Admin' : 'Member'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 font-semibold text-xs">{orgUser.machineCount}</span>
                    </td>
                    <td className="py-3 px-3">
                      <MachineAssignmentPopup machines={orgUser.machines} userName={orgUser.full_name || orgUser.email} />
                    </td>
                    <td className="py-3 px-3 text-right">
                      {orgUser.account_type !== 'super_customer' && (
                        <Link href={`/customer/users/${orgUser.id}/edit`} className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">Edit →</Link>
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
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Machines Needing Attention</h2>
            <span className="ml-auto px-2 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 rounded-full text-xs font-semibold">{needsAttentionMachines.length}</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {needsAttentionMachines.map(m => (
              <div key={m.id} className={`rounded-lg border p-4 ${!m.asset_online ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30' : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{m.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{m.location}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {(m.issues as string[]).map((issue: string) => (
                      <span key={issue} className={`px-2 py-0.5 rounded text-xs font-semibold ${issue === 'Offline' ? 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200' : 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200'}`}>{issue}</span>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Last seen: {formatLastSync(m.last_ping)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
