import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { DashboardView, type Attention, type ActivityItem, type MachineLite } from '@/components/admin/DashboardView';
import { isMachineOnline } from '@/lib/machine-status';
import { rentalState } from '@/lib/rental-state';
import { DAY_MS, IST_OFFSET_MS, istClock, timeAgo } from '@/lib/time';

export const revalidate = 0;

const DAY = DAY_MS;
const IST_OFFSET = IST_OFFSET_MS;
const LOW_STOCK = 5;
const STUCK_AFTER_MS = 5 * 60_000; // a paid UPI order should dispense within seconds
const clock = istClock;
const ago = timeAgo;

/* eslint-disable @typescript-eslint/no-explicit-any */
const RANGES = [7, 14, 30] as const;
type Range = (typeof RANGES)[number];

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const db = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: profile } = await db.from('profiles').select('role, account_type, full_name').eq('id', user.id).single();
  if (profile?.role === 'customer') redirect('/customer/dashboard');

  const isSuperCustomer = profile?.account_type === 'super_customer';
  const { now, todayStart, yesterdayStart } = clock();
  const params = await searchParams;
  const range: Range = (RANGES as readonly number[]).includes(Number(params.range)) ? (Number(params.range) as Range) : 14;
  const rangeStart = todayStart - (range - 1) * DAY;
  const weekIso = new Date(rangeStart).toISOString();

  const machinesQ = db.from('vending_machines').select('id, name, location, last_ping, stock_level, max_capacity, customer_name');
  const { data: machinesRaw } = isSuperCustomer ? await machinesQ.eq('customer_id', user.id) : await machinesQ;
  const machines = (machinesRaw || []) as any[];
  const machineIds = machines.map((m) => m.id);
  const none = isSuperCustomer && machineIds.length === 0;
  const scope = (q: any) => (isSuperCustomer ? q.in('machine_id', machineIds) : q);
  const empty = { data: [] as any[] };

  const [{ data: upi }, { data: coin }, { data: rfid }, { data: rentals }, { data: invoices }] = await Promise.all([
    none ? empty : scope(db.from('transactions').select('id, created_at, total_amount, payment_status, dispensed, machine_id, items').gte('created_at', weekIso)).order('created_at', { ascending: false }).limit(20000),
    none ? empty : scope(db.from('coin_payments').select('id, created_at, amount_in_paisa, machine_id, products(name)').gte('created_at', weekIso)).order('created_at', { ascending: false }).limit(20000),
    none ? empty : scope(db.from('rfid_payments').select('id, created_at, amount_in_paisa, machine_id, products(name)').gte('created_at', weekIso)).order('created_at', { ascending: false }).limit(20000),
    none ? empty : scope(db.from('rental_agreements').select('id, rental_code, machine_id, status, start_date, paid_until')),
    // Organization invoices are an admin concern only
    isSuperCustomer ? empty : db.from('organization_invoices').select('id, invoice_number, amount_due_paisa, organizations(name)').eq('status', 'overdue'),
  ]);

  const machineName = new Map(machines.map((m) => [m.id, m.name as string]));
  const machineLocation = new Map(machines.map((m) => [m.id, (m.location as string) || 'Unknown']));

  // ── Successful payments across all three methods ──
  type Pay = { at: string; amount: number; type: 'upi' | 'coin' | 'rfid'; machine: string; id: string; product: string; location: string };
  const firstItem = (items: any) => { const arr = typeof items === 'string' ? JSON.parse(items) : items || []; return arr[0]?.name || 'Product'; };
  const pays: Pay[] = [
    ...(upi || []).filter((t: any) => t.payment_status === 'paid').map((t: any) => ({ at: t.created_at, amount: Number(t.total_amount) || 0, type: 'upi' as const, machine: machineName.get(t.machine_id) || 'Machine', id: `u${t.id}`, product: firstItem(t.items), location: machineLocation.get(t.machine_id) || 'Unknown' })),
    ...(coin || []).map((t: any) => ({ at: t.created_at, amount: (t.amount_in_paisa || 0) / 100, type: 'coin' as const, machine: machineName.get(t.machine_id) || 'Machine', id: `c${t.id}`, product: t.products?.name || 'Product', location: machineLocation.get(t.machine_id) || 'Unknown' })),
    ...(rfid || []).map((t: any) => ({ at: t.created_at, amount: (t.amount_in_paisa || 0) / 100, type: 'rfid' as const, machine: machineName.get(t.machine_id) || 'Machine', id: `r${t.id}`, product: t.products?.name || 'Product', location: machineLocation.get(t.machine_id) || 'Unknown' })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const ts = (p: Pay) => new Date(p.at).getTime();
  const today = pays.filter((p) => ts(p) >= todayStart);
  const yesterday = pays.filter((p) => ts(p) >= yesterdayStart && ts(p) < todayStart);
  const sum = (ps: Pay[]) => ps.reduce((s, p) => s + p.amount, 0);

  const trend = Array.from({ length: range }, (_, i) => {
    const from = rangeStart + i * DAY;
    return {
      label: new Date(from + IST_OFFSET).toLocaleDateString('en-IN', range <= 7 ? { weekday: 'short', timeZone: 'UTC' } : { day: 'numeric', month: 'short', timeZone: 'UTC' }),
      value: sum(pays.filter((p) => ts(p) >= from && ts(p) < from + DAY)),
    };
  });
  const bestDay = Math.max(...trend.map((t) => t.value), 0);
  const dayPays = (i: number) => { const from = rangeStart + i * DAY; return pays.filter((p) => ts(p) >= from && ts(p) < from + DAY); };
  const trendUpi = trend.map((_, i) => sum(dayPays(i).filter((p) => p.type === 'upi')));
  const trendCount = trend.map((_, i) => dayPays(i).length);

  // Busiest weekdays (IST) for the radar
  const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const byWeekday = WEEK.map((label) => ({ label, value: 0 }));
  for (const p of pays) byWeekday[(new Date(ts(p) + IST_OFFSET).getUTCDay() + 6) % 7].value += p.amount;

  const leader = (key: 'product' | 'location' | 'type') => {
    const totals = pays.reduce<Record<string, number>>((acc, p) => { acc[p[key]] = (acc[p[key]] || 0) + p.amount; return acc; }, {});
    const [label, value] = Object.entries(totals).sort((a, b) => b[1] - a[1])[0] || ['—', 0];
    return { label, value, count: pays.filter((p) => p[key] === label).length };
  };
  const tops = { product: leader('product'), location: leader('location'), method: leader('type') };

  const mix = { upi: sum(pays.filter((p) => p.type === 'upi')), coin: sum(pays.filter((p) => p.type === 'coin')), rfid: sum(pays.filter((p) => p.type === 'rfid')) };

  const topMachines = Object.entries(pays.reduce<Record<string, number>>((acc, p) => { acc[p.machine] = (acc[p.machine] || 0) + p.amount; return acc; }, {}))
    .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, value]) => ({ label, value }));

  const activity: ActivityItem[] = pays.slice(0, 8).map((p) => ({ id: p.id, type: p.type, machine: p.machine, amount: p.amount, when: ago(p.at, now) }));

  // ── Fleet ──
  const fleet: MachineLite[] = machines.map((m) => ({
    id: m.id, name: m.name, location: m.location, online: isMachineOnline(m.last_ping),
    stock: typeof m.stock_level === 'number' ? m.stock_level : null, capacity: m.max_capacity || null, lastSeen: ago(m.last_ping, now),
  }));
  const online = fleet.filter((m) => m.online).length;
  const withCapacity = fleet.filter((m) => m.stock !== null && m.capacity);
  const stockTotal = withCapacity.reduce((t, m) => t + (m.stock || 0), 0);
  const capacityTotal = withCapacity.reduce((t, m) => t + (m.capacity || 0), 0);
  const offlineList = fleet.filter((m) => !m.online);
  const emptyList = fleet.filter((m) => m.stock === 0);
  const lowList = fleet.filter((m) => m.stock !== null && m.stock > 0 && m.stock < LOW_STOCK);

  // ── Needs attention: most urgent first ──
  const attention: Attention[] = [];
  for (const t of (upi || []) as any[]) {
    if (t.payment_status === 'paid' && t.dispensed === false && now - new Date(t.created_at).getTime() > STUCK_AFTER_MS) {
      attention.push({ level: 'critical', kind: 'stuck', title: `Paid ₹${Number(t.total_amount).toFixed(0)} but not dispensed`, detail: `${machineName.get(t.machine_id) || 'Machine'} · ${ago(t.created_at, now)} — check & refund`, href: '/admin/transactions?range=7' });
    }
  }
  // Offline machines' stock readings are stale, so "empty" only alerts for machines that are reporting.
  for (const m of emptyList) if (m.online) attention.push({ level: 'critical', kind: 'stock', title: `${m.name} is empty`, detail: `${m.location || 'No location'} · refill now`, href: '/admin/machines' });
  // Recent drop-offs are actionable one by one; machines dark for over a week collapse into one line.
  const pingAt = new Map(machines.map((m) => [m.id, m.last_ping ? new Date(m.last_ping).getTime() : 0]));
  const offlineSorted = [...offlineList].sort((a, b) => (pingAt.get(b.id) || 0) - (pingAt.get(a.id) || 0));
  const staleOffline = offlineSorted.filter((m) => now - (pingAt.get(m.id) || 0) > 7 * DAY_MS);
  for (const m of offlineSorted) {
    if (staleOffline.includes(m)) continue;
    attention.push({ level: 'critical', kind: 'offline', title: `${m.name} is offline`, detail: `${m.location || 'No location'} · last seen ${m.lastSeen}`, href: '/admin/machines' });
  }
  if (staleOffline.length) {
    attention.push({
      level: 'warning', kind: 'offline',
      title: staleOffline.length === 1 ? `${staleOffline[0].name} offline for over a week` : `${staleOffline.length} machines offline for over a week`,
      detail: staleOffline.length === 1 ? `last seen ${staleOffline[0].lastSeen}` : staleOffline.slice(0, 3).map((m) => m.name).join(', ') + (staleOffline.length > 3 ? ` +${staleOffline.length - 3}` : ''),
      href: '/admin/machines',
    });
  }
  for (const r of (rentals || []) as any[]) {
    const st = rentalState(r);
    if (st === 'locked') attention.push({ level: 'critical', kind: 'rental', title: `Rental ${r.rental_code} paused`, detail: `${machineName.get(r.machine_id) || 'Machine'} · rent unpaid, vending stopped`, href: '/admin/rentals' });
    if (st === 'grace') attention.push({ level: 'warning', kind: 'rental', title: `Rental ${r.rental_code} overdue`, detail: `${machineName.get(r.machine_id) || 'Machine'} · in grace period`, href: '/admin/rentals' });
  }
  for (const m of lowList) attention.push({ level: 'warning', kind: 'stock', title: `${m.name} low on stock`, detail: `${m.stock} left · ${m.location || 'No location'}`, href: '/admin/machines' });
  for (const inv of (invoices || []) as any[]) attention.push({ level: 'warning', kind: 'invoice', title: `Coins uncollected — ${inv.organizations?.name || 'Organization'}`, detail: `Statement ${inv.invoice_number} · ₹${((inv.amount_due_paisa || 0) / 100).toFixed(2)} still to collect`, href: `/admin/billing/${inv.id}` });

  // Machine table: revenue in range per machine
  const revenueById = new Map<string, number>();
  for (const t of (upi || []) as any[]) if (t.payment_status === 'paid') revenueById.set(t.machine_id, (revenueById.get(t.machine_id) || 0) + (Number(t.total_amount) || 0));
  for (const t of [...((coin || []) as any[]), ...((rfid || []) as any[])]) revenueById.set(t.machine_id, (revenueById.get(t.machine_id) || 0) + (t.amount_in_paisa || 0) / 100);
  const fleetRows = fleet.map((m) => ({ ...m, revenue: revenueById.get(m.id) || 0 })).sort((a, b) => b.revenue - a.revenue || Number(b.online) - Number(a.online));

  const firstName = (profile?.full_name || user.email?.split('@')[0] || 'there').split(' ')[0];
  const initials = (profile?.full_name || user.email || 'A').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w: string) => w[0]!.toUpperCase()).join('');

  return (
    <DashboardView
      firstName={firstName}
      initials={initials}
      email={user.email || undefined}
      todayLabel={new Date(now).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' })}
      todayRevenue={sum(today)}
      todayCount={today.length}
      yesterdayRevenue={sum(yesterday)}
      yesterdayCount={yesterday.length}
      range={range}
      weekRevenue={sum(pays)}
      bestDay={bestDay}
      byWeekday={byWeekday}
      tops={tops}
      stockTotal={stockTotal}
      capacityTotal={capacityTotal}
      trend={trend}
      mix={mix}
      topMachines={topMachines}
      activity={activity}
      totalMachines={fleet.length}
      onlineMachines={online}
      offlineMachines={offlineList.length}
      lowStockMachines={lowList.length + emptyList.length}
      attention={attention}
      trendUpi={trendUpi}
      trendCount={trendCount}
      machines={fleetRows}
    />
  );
}
