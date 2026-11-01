import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { TrendingUp, Users, Nfc, Calendar, Trophy } from 'lucide-react';
import { PageHeader } from '@/components/ui/kit';
import type { GlanceAlert, GlanceMachine } from '@/components/customer/CustomerGlance';
import { DAY_MS, IST_OFFSET_MS, istClock, timeAgo } from '@/lib/time';
import { CustomerDashboardView } from '@/components/customer/CustomerDashboardView';
import { rentalState } from '@/lib/rental-state';
import { visibleOwnerIds } from '@/lib/machine-scope';
import Link from 'next/link';
import MachineAssignmentPopup from '@/components/MachineAssignmentPopup';
import TransactionsTable from '@/components/TransactionsTable';
import DashboardTabs from '@/components/DashboardTabs';
import RfidCardsUsagePanel from '@/components/RfidCardsUsagePanel';
import ReportDownload from '@/components/ReportDownload';

// Force dynamic rendering - never cache this page to ensure real-time status
export const revalidate = 0;

const RANGES = [7, 14, 30] as const;
type Range = (typeof RANGES)[number];

export default async function CustomerDashboard({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
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

  // Super customers see every machine in their company — including ones assigned
  // to a team member (assignment moves customer_id to that person). Regular
  // customers see only the machines assigned to them.
  const ownerIds = await visibleOwnerIds(serviceSupabase, user.id, profile);
  const { data: orgMachines } = await serviceSupabase
    .from('vending_machines')
    .select('id, name, location, status, asset_online, stock_level, max_capacity, customer_id, last_ping, rfid_enabled')
    .in('customer_id', ownerIds);

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

  // Transaction stats

  // Revenue calculations

  const rfidRevenue = (rfidPayments?.reduce((sum, tx) => sum + (tx.amount_in_paisa || 0), 0) || 0) / 100;

  // Machine health analysis using real-time status

  // Breakdown by payment method
  const rfidTransactionCount = rfidPayments?.length || 0;

  // Format date for last sync display

  // Machine-wise breakdown for bar chart

  // Revenue by day (last 14 days) for area chart
  const now = new Date();

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
          machine:vending_machines!rfid_cards_machine_id_fkey ( id, name, location )
        `)
        .or(rfidCardFilters.join(','))
        .order('created_at', { ascending: false })
    : { data: [] };

  // Helpers
  // ── At-a-glance: today, alerts, machine board ──
  const { now: glanceNow, todayStart, yesterdayStart } = istClock();
  const { data: myRentals } = machineIds.length
    ? await serviceSupabase.from('rental_agreements').select('rental_code, machine_id, status, start_date, paid_until').in('machine_id', machineIds)
    : { data: [] as { rental_code: string; machine_id: string; status: string; start_date: string | null; paid_until: string | null }[] };
  const successRows = [
    ...(onlineTransactions || []).filter((t) => t.payment_status === 'paid').map((t) => ({ at: t.created_at, amount: parseFloat(String(t.total_amount || 0)) })),
    ...(coinPayments || []).map((t) => ({ at: t.created_at, amount: (t.amount_in_paisa || 0) / 100 })),
    ...(rfidPayments || []).map((t) => ({ at: t.created_at, amount: (t.amount_in_paisa || 0) / 100 })),
  ];
  const inDay = (from: number) => successRows.filter((r) => { const t = new Date(r.at).getTime(); return t >= from && t < from + DAY_MS; });
  const todayRows = inDay(todayStart);
  // Team members (super customer excluded) → shown as "Assigned to …" on each machine
  const memberName = new Map(orgUsersWithMachines.map((u) => [u.id, u.full_name || u.email]));
  const glanceMachines: GlanceMachine[] = (machinesWithUpdatedStatus || []).map((m) => ({
    id: m.id, name: m.name, location: m.location ?? null, online: !!m.asset_online,
    stock: typeof m.stock_level === 'number' ? m.stock_level : null, capacity: m.max_capacity || null,
    lastSeen: timeAgo(m.last_ping, glanceNow),
    assignee: memberName.get(m.customer_id) ?? null,
  }));
  const glanceAlerts: GlanceAlert[] = [];
  // Recently dropped machines are actionable one by one; ones dark for over a week collapse into a
  // single line so they don't bury everything else.
  const pingAt = new Map((machinesWithUpdatedStatus || []).map((m) => [m.id, m.last_ping ? new Date(m.last_ping).getTime() : 0]));
  const offlineMachines = glanceMachines.filter((m) => !m.online).sort((a, b) => (pingAt.get(b.id) || 0) - (pingAt.get(a.id) || 0));
  const staleOffline = offlineMachines.filter((m) => glanceNow - (pingAt.get(m.id) || 0) > 7 * DAY_MS);
  for (const m of glanceMachines) {
    if (m.stock === 0 && m.online) glanceAlerts.push({ level: 'critical', kind: 'stock', title: `${m.name} is empty`, detail: `${m.location ? `${m.location} · ` : ''}ask for a refill`, href: '/customer/machines' });
  }
  for (const m of offlineMachines) {
    if (staleOffline.includes(m)) continue;
    glanceAlerts.push({ level: 'critical', kind: 'offline', title: `${m.name} is offline`, detail: `last seen ${m.lastSeen} · check power & network`, href: '/customer/machines' });
  }
  if (staleOffline.length) {
    glanceAlerts.push({
      level: 'warning', kind: 'offline',
      title: staleOffline.length === 1 ? `${staleOffline[0].name} offline for over a week` : `${staleOffline.length} machines offline for over a week`,
      detail: staleOffline.length === 1 ? `last seen ${staleOffline[0].lastSeen}` : staleOffline.slice(0, 3).map((m) => m.name).join(', ') + (staleOffline.length > 3 ? ` +${staleOffline.length - 3}` : ''),
      href: '/customer/machines',
    });
  }
  for (const r of myRentals || []) {
    const st = rentalState(r);
    const name = glanceMachines.find((m) => m.id === r.machine_id)?.name || r.rental_code;
    if (st === 'locked') glanceAlerts.push({ level: 'critical', kind: 'rental', title: `Rent unpaid — ${name} paused`, detail: 'Recharge rent to restore UPI & RFID vending', href: '/customer/rental' });
    if (st === 'grace') glanceAlerts.push({ level: 'warning', kind: 'rental', title: `Rent overdue — ${name}`, detail: 'In grace period · recharge to avoid a pause', href: '/customer/rental' });
  }
  for (const m of glanceMachines) {
    if (m.stock !== null && m.stock > 0 && m.stock < 5) glanceAlerts.push({ level: 'warning', kind: 'stock', title: `${m.name} low on stock`, detail: `${m.stock} left`, href: '/customer/machines' });
  }

  // ── Analytics-console data (reference layout) ──
  const params = await searchParams;
  const range: Range = (RANGES as readonly number[]).includes(Number(params.range)) ? (Number(params.range) as Range) : 14;
  const rangeStart = todayStart - (range - 1) * DAY_MS;
  const firstItem = (items: unknown) => {
    const arr = (typeof items === 'string' ? JSON.parse(items) : items || []) as { name?: string }[];
    return arr[0]?.name || 'Product';
  };
  type CPay = { id: string; at: number; amount: number; type: 'upi' | 'coin' | 'rfid'; machine: string; product: string };
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const cpays: CPay[] = [
    ...(onlineTransactions || []).filter((t: any) => t.payment_status === 'paid').map((t: any) => ({ id: `u${t.id}`, at: new Date(t.created_at).getTime(), amount: parseFloat(String(t.total_amount || 0)), type: 'upi' as const, machine: t.vending_machines?.name || 'Machine', product: firstItem(t.items) })),
    ...(coinPayments || []).map((t: any) => ({ id: `c${t.id}`, at: new Date(t.created_at).getTime(), amount: (t.amount_in_paisa || 0) / 100, type: 'coin' as const, machine: t.vending_machines?.name || 'Machine', product: t.products?.name || 'Product' })),
    ...(rfidPayments || []).map((t: any) => ({ id: `r${t.id}`, at: new Date(t.created_at).getTime(), amount: (t.amount_in_paisa || 0) / 100, type: 'rfid' as const, machine: t.vending_machines?.name || 'Machine', product: t.products?.name || 'Product' })),
  ].sort((a, b) => b.at - a.at);
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const inRange = cpays.filter((p) => p.at >= rangeStart);
  const trend = Array.from({ length: range }, (_, i) => {
    const from = rangeStart + i * DAY_MS;
    return {
      label: new Date(from + IST_OFFSET_MS).toLocaleDateString('en-IN', range <= 7 ? { weekday: 'short', timeZone: 'UTC' } : { day: 'numeric', month: 'short', timeZone: 'UTC' }),
      value: inRange.filter((p) => p.at >= from && p.at < from + DAY_MS).reduce((t, p) => t + p.amount, 0),
    };
  });
  const inDayOf = (i: number) => { const from = rangeStart + i * DAY_MS; return inRange.filter((p) => p.at >= from && p.at < from + DAY_MS); };
  const trendUpi = trend.map((_, i) => inDayOf(i).filter((p) => p.type === 'upi').reduce((t, p) => t + p.amount, 0));
  const trendCount = trend.map((_, i) => inDayOf(i).length);
  const mix = { upi: 0, coin: 0, rfid: 0 };
  for (const p of inRange) mix[p.type] += p.amount;
  const revenueByMachine: Record<string, number> = {};
  for (const p of inRange) revenueByMachine[p.machine] = (revenueByMachine[p.machine] || 0) + p.amount;
  const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const byWeekday = WEEK.map((label) => ({ label, value: 0 }));
  for (const p of inRange) byWeekday[(new Date(p.at + IST_OFFSET_MS).getUTCDay() + 6) % 7].value += p.amount;
  const leader = (key: 'machine' | 'product' | 'type') => {
    const totals = inRange.reduce<Record<string, number>>((acc, p) => { acc[p[key]] = (acc[p[key]] || 0) + p.amount; return acc; }, {});
    const [label, value] = Object.entries(totals).sort((a, b) => b[1] - a[1])[0] || ['—', 0];
    return { label, value, count: inRange.filter((p) => p[key] === label).length };
  };
  const yesterdayRows = inDay(yesterdayStart);

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
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 20,
  boxShadow: 'var(--shadow-card)',
};

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        subtitle="Real-time overview of your vending machine network"
        actions={<><span className="db-live"><span className="db-live-dot" />Live</span><ReportDownload /></>}
      />

      <DashboardTabs
        overview={
      <>
      <CustomerDashboardView
        range={range}
        todayRevenue={todayRows.reduce((t, r) => t + r.amount, 0)}
        todayCount={todayRows.length}
        yesterdayRevenue={yesterdayRows.reduce((t, r) => t + r.amount, 0)}
        yesterdayCount={yesterdayRows.length}
        trend={trend}
        byWeekday={byWeekday}
        tops={{ machine: leader('machine'), product: leader('product'), method: leader('type') }}
        activity={cpays.slice(0, 8).map((p) => ({ id: p.id, type: p.type, machine: p.machine, amount: p.amount, when: timeAgo(new Date(p.at).toISOString(), glanceNow) }))}
        machines={glanceMachines}
        alerts={glanceAlerts}
        firstName={(profile?.full_name || user.email?.split('@')[0] || 'there').split(' ')[0]}
        trendUpi={trendUpi}
        trendCount={trendCount}
        mix={mix}
        revenueByMachine={revenueByMachine}
        showAssignee={isSuperCustomer}
      />

      {/* Transactions */}
      <div id="transactions" className="scroll-mt-6"><TransactionsTable transactions={last10Transactions} /></div>

      {/* Team & Machine Access (super customer only) */}
      {isSuperCustomer && orgUsersWithMachines.length > 0 && (
        <div className="rounded-2xl p-5" style={CARD}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-[var(--fg)]">Team &amp; Machine Access</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Users in your organization</p>
            </div>
            <Link
              href="/customer/users"
              className="px-3 py-1.5 text-xs font-semibold text-white lyra-chamfer transition-all active:scale-[0.97]"
              style={{ background: 'var(--accent)', boxShadow: '0 4px 14px rgba(0,0,0,0.04)' }}
            >
              Manage Users
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--surface-2)' }}>
                  {['User', 'Email', 'Role', 'Machines', 'Devices', 'Actions'].map((h, i) => (
                    <th
                      key={h}
                      className={`py-2 px-3 text-xs font-semibold uppercase tracking-wide ${i === 1 ? 'text-left hidden sm:table-cell' : i === 2 || i === 3 ? 'text-center' : i === 5 ? 'text-right' : 'text-left'}`}
                      style={{ color: 'var(--subtle)' }}
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
                    style={{ borderBottom: '1px solid var(--surface-2)' }}
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[#ffffff] font-semibold text-xs shrink-0"
                          style={{ background: 'var(--accent)' }}
                        >
                          {(orgUser.full_name || orgUser.email || 'U').charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-[var(--fg)] truncate max-w-24">{orgUser.full_name || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 hidden sm:table-cell" style={{ color: 'var(--muted)' }}>{orgUser.email}</td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={orgUser.account_type === 'super_customer'
                          ? { background: 'rgba(0,0,0,0.04)', color: 'var(--muted)' }
                          : { background: 'var(--surface-2)', color: 'var(--muted)' }
                        }
                      >
                        {orgUser.account_type === 'super_customer' ? 'Admin' : 'Member'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold"
                        style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)' }}
                      >
                        {orgUser.machineCount}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <MachineAssignmentPopup machines={orgUser.machines} userName={orgUser.full_name || orgUser.email} />
                    </td>
                    <td className="py-3 px-3 text-right">
                      {orgUser.account_type !== 'super_customer' && (
                        <Link href={`/customer/users/${orgUser.id}/edit`} className="text-xs font-medium hover:text-[var(--fg)] transition-colors" style={{ color: 'var(--accent-ink)' }}>
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

      </>
        }
        rfid={hasRfidMachines ? (
          <>
            {/* RFID KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total RFID Taps',   value: String(rfidTransactionCount),           sub: `across ${rfidMachineStats.length} machine${rfidMachineStats.length !== 1 ? 's' : ''}`, icon: Nfc,       color: 'var(--muted)', bg: 'rgba(0,0,0,0.04)' },
                { label: 'Total RFID Revenue', value: `₹${formatAmount(rfidRevenue)}`,         sub: 'all-time',                                                                              icon: TrendingUp, color: 'var(--success)', bg: 'rgba(29,122,60,0.12)' },
                { label: 'Unique Cards Used',  value: String(uniqueCardCount),                 sub: 'distinct RFID cards',                                                                   icon: Users,      color: 'var(--accent-ink)', bg: 'var(--accent-soft)' },
                { label: 'Daily Average',      value: rfidOverallDailyAverage.toFixed(1),       sub: 'taps per active day',                                                                   icon: Calendar,   color: 'var(--warning)', bg: 'rgba(154,100,0,0.12)' },
              ].map(({ label, value, sub, icon: Icon, color, bg }) => (
                <div key={label} className="rounded-2xl p-5 relative overflow-hidden" style={CARD}>
                  <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-full" style={{ background: bg, opacity: 0.4 }} />
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: bg }}>
                    <Icon className="w-4 h-4" style={{ color }} />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>{label}</p>
                  <p className="text-xl font-bold text-[var(--fg)]">{value}</p>
                  <p className="text-xs mt-1 font-medium" style={{ color }}>{sub}</p>
                </div>
              ))}
            </div>

            {/* Card holders — wallet / no-limit sub-tabs with balance controls */}
            <RfidCardsUsagePanel initialCards={(rfidCardRecords as any) || []} />

            {/* 14-day tap trend */}
            <div className="rounded-2xl p-5" style={CARD}>
              <h2 className="font-semibold text-[var(--fg)] mb-0.5">Tap Activity</h2>
              <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>Last 14 days — RFID taps per day</p>
              <div className="flex items-end gap-1.5 h-32">
                {(() => {
                  const max = Math.max(...rfidDailyTrend.map(d => d.count), 1);
                  return rfidDailyTrend.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                      <span className="text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--muted)' }}>{d.count}</span>
                      <div
                        className="w-full rounded-t-md transition-all"
                        style={{
                          height: `${Math.max((d.count / max) * 100, d.count > 0 ? 6 : 2)}%`,
                          background: d.count > 0 ? 'linear-gradient(180deg, #3B82F6, var(--accent))' : 'var(--surface-2)',
                        }}
                      />
                      <span className="text-[9px]" style={{ color: 'var(--subtle)' }}>{d.date.split(' ')[1]}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              {/* Top consumers */}
              <div className="rounded-2xl p-5" style={CARD}>
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="w-4 h-4" style={{ color: 'var(--warning)' }} />
                  <h2 className="font-semibold text-[var(--fg)]">Top Consumers</h2>
                </div>
                {topConsumers.length > 0 ? (
                  <div className="space-y-0 max-h-80 overflow-y-auto">
                    {topConsumers.map((c, i) => (
                      <div key={c.label + i} className="flex items-center justify-between py-2.5" style={{ borderBottom: '1px solid var(--surface-2)' }}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                            style={i === 0
                              ? { background: 'rgba(154,100,0,0.12)', color: 'var(--warning)' }
                              : { background: 'var(--surface-2)', color: 'var(--muted)' }}
                          >
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[var(--fg)] truncate">{c.label}</p>
                            {c.label !== c.uid && (
                              <p className="text-xs font-mono truncate" style={{ color: 'var(--subtle)' }}>{c.uid}</p>
                            )}
                            <p className="text-xs" style={{ color: 'var(--subtle)' }}>Last tap {formatTimeAgo(c.lastTap)}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <p className="text-sm font-bold text-[var(--fg)]">{c.count} taps</p>
                          <p className="text-xs" style={{ color: 'var(--muted)' }}>₹{formatAmount(c.amount)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-center py-8" style={{ color: 'var(--subtle)' }}>No RFID taps recorded yet</p>
                )}
              </div>

              {/* Per-machine RFID breakdown */}
              <div className="rounded-2xl p-5" style={CARD}>
                <h2 className="font-semibold text-[var(--fg)] mb-0.5">By Machine</h2>
                <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>Taps, revenue &amp; daily average per machine</p>
                {rfidMachineStats.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--surface-2)' }}>
                          <th className="text-left py-2 px-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--subtle)' }}>Machine</th>
                          <th className="text-right py-2 px-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--subtle)' }}>Taps</th>
                          <th className="text-right py-2 px-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--subtle)' }}>Revenue</th>
                          <th className="text-right py-2 px-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--subtle)' }}>Avg/Day</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rfidMachineStats.map(m => (
                          <tr key={m.id} style={{ borderBottom: '1px solid var(--surface-2)' }}>
                            <td className="py-2.5 px-2">
                              <p className="font-medium text-[var(--fg)] truncate max-w-32">{m.name}</p>
                              <p className="text-xs truncate max-w-32" style={{ color: 'var(--subtle)' }}>{m.location}</p>
                            </td>
                            <td className="py-2.5 px-2 text-right font-semibold text-[var(--fg)]">{m.transactionCount}</td>
                            <td className="py-2.5 px-2 text-right" style={{ color: 'var(--muted)' }}>₹{formatAmount(m.revenue)}</td>
                            <td className="py-2.5 px-2 text-right" style={{ color: 'var(--muted)' }}>{m.dailyAverage.toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-center py-8" style={{ color: 'var(--subtle)' }}>No RFID-enabled machines with activity yet</p>
                )}
              </div>
            </div>
          </>
        ) : undefined}
      />
    </main>
  );
}
