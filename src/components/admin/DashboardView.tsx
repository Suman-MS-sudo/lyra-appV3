import Link from 'next/link';
import {
  AlertOctagon, Banknote, Building2, CheckCircle2, Coins, CreditCard, Download, FileWarning,
  KeyRound, Nfc, PackageOpen, Receipt, Smile, Wallet, WifiOff, Zap,
} from 'lucide-react';
import ReportDownload from '@/components/ReportDownload';
import { FleetWelcome, type WelcomeChip } from '@/components/ui/FleetWelcome';
import { AlertList } from '@/components/ui/lists';
import { Panel, Radar, inr } from '@/components/ui/kit';
import { VxAreaChart, VxBars, VxGauge, VxKpi, VxMiniStat, VxRing, VxTimeline } from '@/components/ui/vision';

export interface Attention {
  level: 'critical' | 'warning';
  kind: 'stuck' | 'offline' | 'stock' | 'rental' | 'invoice';
  title: string;
  detail: string;
  href: string;
}

export interface ActivityItem {
  id: string;
  type: 'upi' | 'coin' | 'rfid';
  machine: string;
  amount: number;
  when: string;
}

export interface MachineLite {
  id: string;
  name: string;
  location: string | null;
  online: boolean;
  stock: number | null;
  capacity: number | null;
  lastSeen: string;
}

type Leader = { label: string; value: number; count: number };

export interface DashboardData {
  firstName: string;
  initials: string;
  email?: string;
  todayLabel: string;
  todayRevenue: number;
  todayCount: number;
  yesterdayRevenue: number;
  yesterdayCount: number;
  range: 7 | 14 | 30;
  weekRevenue: number;
  bestDay: number;
  trend: { label: string; value: number }[];
  trendUpi: number[];
  trendCount: number[];
  byWeekday: { label: string; value: number }[];
  mix: { upi: number; coin: number; rfid: number };
  topMachines: { label: string; value: number }[];
  tops: { product: Leader; location: Leader; method: Leader };
  activity: ActivityItem[];
  machines: (MachineLite & { revenue: number })[];
  totalMachines: number;
  onlineMachines: number;
  offlineMachines: number;
  lowStockMachines: number;
  stockTotal: number;
  capacityTotal: number;
  attention: Attention[];
}

const KIND_ICON: Record<Attention['kind'], React.ElementType> = {
  stuck: AlertOctagon, offline: WifiOff, stock: PackageOpen, rental: KeyRound, invoice: FileWarning,
};
export const PAY_META = {
  upi: { label: 'UPI', icon: CreditCard, color: '#2cd9ff' },
  coin: { label: 'Coin', icon: Coins, color: '#ffb547' },
  rfid: { label: 'RFID', icon: Nfc, color: '#a78bfa' },
} as const;
const RANGE_LABEL = { 7: '7d', 14: '2w', 30: '1m' } as const;

export function delta(cur: number, prev: number) {
  if (prev <= 0) return cur > 0 ? { text: 'new', up: true } : undefined;
  const p = Math.round(((cur - prev) / prev) * 100);
  return { text: `${p >= 0 ? '+' : '-'}${Math.abs(p)}%`, up: p >= 0 };
}

/** Status chips for the welcome card. */
export function welcomeChips(urgent: number, offline: number, refill: number): WelcomeChip[] {
  const chips: WelcomeChip[] = [];
  chips.push(urgent ? { label: `${urgent} urgent`, tone: 'bad', href: '#attention' } : { label: 'Nothing urgent', tone: 'ok' });
  chips.push(offline ? { label: `${offline} offline`, tone: 'bad', href: '#attention' } : { label: 'All online', tone: 'ok' });
  if (refill) chips.push({ label: `${refill} need refill`, tone: 'warn', href: '#attention' });
  return chips;
}

export function RangePills({ range, csv, file }: { range: 7 | 14 | 30; csv: string; file: string }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <nav className="ui-pills" aria-label="Range">
        {([7, 14, 30] as const).map((r) => (
          <Link key={r} href={`?range=${r}`} scroll={false} className={r === range ? 'is-active' : ''} aria-current={r === range ? 'page' : undefined}>
            {RANGE_LABEL[r]}
          </Link>
        ))}
      </nav>
      <a className="ui-download" href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`} download={file}>
        <Download className="w-3.5 h-3.5" /> CSV
      </a>
    </div>
  );
}

/** Admin dashboard: console layout (KPIs · welcome/gauge/score · charts · machines/timeline · alerts). */
export function DashboardView(d: DashboardData) {
  const critical = d.attention.filter((a) => a.level === 'critical').length;
  const rangeTotal = d.trend.reduce((s, t) => s + t.value, 0);
  const rangeCount = d.trendCount.reduce((s, n) => s + n, 0);
  const onlinePct = d.totalMachines ? (d.onlineMachines / d.totalMachines) * 100 : 0;
  const stockPct = d.capacityTotal ? (d.stockTotal / d.capacityTotal) * 100 : 0;
  const mixTotal = d.mix.upi + d.mix.coin + d.mix.rfid;
  const csv = 'Day,Revenue (INR),UPI (INR),Payments\n' + d.trend.map((t, i) => `${t.label},${t.value.toFixed(2)},${(d.trendUpi[i] || 0).toFixed(2)},${d.trendCount[i] || 0}`).join('\n');

  return (
    <main className="px-4 sm:px-8 pt-4 pb-10 max-w-[1500px] mx-auto flex flex-col gap-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-5">
        <VxKpi label="Today's revenue" value={inr(d.todayRevenue)} change={delta(d.todayRevenue, d.yesterdayRevenue)} icon={Wallet} />
        <VxKpi label="Payments today" value={d.todayCount.toLocaleString('en-IN')} change={delta(d.todayCount, d.yesterdayCount)} icon={Receipt} />
        <VxKpi label="Machines online" value={`${d.onlineMachines}/${d.totalMachines}`} change={d.offlineMachines ? { text: `${d.offlineMachines} off`, up: false } : { text: 'all', up: true }} icon={Building2} />
        <VxKpi label={`Revenue · last ${d.range} days`} value={inr(rangeTotal)} change={{ text: `${rangeCount}`, up: true }} icon={Banknote} />
      </div>

      {/* Welcome · gauge · score */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.85fr)_minmax(0,1.15fr)] gap-6">
        <FleetWelcome
          name={d.firstName}
          revenue={inr(d.todayRevenue)}
          payments={d.todayCount}
          change={delta(d.todayRevenue, d.yesterdayRevenue)}
          chips={welcomeChips(critical, d.offlineMachines, d.lowStockMachines)}
          href="/admin/transactions?range=7"
          linkLabel="View transactions"
          fleet={d.machines.map((m) => ({ id: m.id, name: m.name, online: m.online }))}
        />
        <Panel title="Machines online" className="lg:col-span-1">
          <p className="text-xs -mt-3 mb-2 text-[var(--muted)]">Across the whole fleet</p>
          <VxGauge pct={onlinePct} icon={Smile} caption={`${d.onlineMachines} of ${d.totalMachines} reporting`} />
        </Panel>
        <Panel title="Stock health" href="/admin/machines" hrefLabel="Machines" className="lg:col-span-2 xl:col-span-1">
          <div className="vx-score">
            <div>
              <div className="vx-inner vx-score-stat"><p>Need refill</p><strong>{d.lowStockMachines} machine{d.lowStockMachines === 1 ? '' : 's'}</strong></div>
              <div className="vx-inner vx-score-stat"><p>Offline</p><strong>{d.offlineMachines} machine{d.offlineMachines === 1 ? '' : 's'}</strong></div>
            </div>
            <VxRing pct={stockPct} value={d.stockTotal.toLocaleString('en-IN')} label="Fleet stock" tone={stockPct < 25 ? 'bad' : stockPct < 50 ? 'warn' : 'ok'} />
          </div>
        </Panel>
      </div>

      {/* Sales overview · payments */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] gap-6">
        <Panel title="Sales overview" actions={<div className="flex items-center gap-3"><RangePills range={d.range} csv={csv} file={`lyra-sales-${RANGE_LABEL[d.range]}.csv`} /><ReportDownload /></div>}>
          <div className="flex flex-wrap items-center justify-between gap-3 -mt-2 mb-4">
            <p className="text-sm text-[var(--muted)]"><span className="font-bold vx-up">{inr(rangeTotal)}</span> collected in the last {d.range} days</p>
            <div className="vx-legend"><span><i style={{ background: '#0075ff' }} />All payments</span><span><i style={{ background: '#2cd9ff' }} />UPI</span></div>
          </div>
          <VxAreaChart
            labels={d.trend.map((t) => t.label)}
            series={[{ name: 'All', values: d.trend.map((t) => t.value), color: '#0075ff' }, { name: 'UPI', values: d.trendUpi, color: '#2cd9ff' }]}
            format={(n) => inr(n)}
          />
        </Panel>

        <Panel>
          <VxBars values={d.trendCount} labels={d.trend.map((t) => t.label)} />
          <h2 className="ui-panel-title mt-6">Payments</h2>
          <p className="text-sm mt-1 text-[var(--muted)]"><span className="font-bold vx-up">{rangeCount.toLocaleString('en-IN')}</span> in the last {d.range} days</p>
          <div className="vx-ministats">
            {(['upi', 'coin', 'rfid'] as const).map((k) => (
              <VxMiniStat key={k} icon={PAY_META[k].icon} label={PAY_META[k].label} value={inr(d.mix[k])} pct={mixTotal ? (d.mix[k] / mixTotal) * 100 : 0} />
            ))}
            <VxMiniStat icon={Zap} label="Online" value={`${d.onlineMachines}/${d.totalMachines}`} pct={onlinePct} />
          </div>
        </Panel>
      </div>

      {/* Machines · live activity */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] gap-6">
        <Panel title="Machines" href="/admin/machines">
          <p className="text-sm -mt-3 mb-3 text-[var(--muted)] flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
            <span><b className="text-[var(--fg)]">{d.onlineMachines} online</b> · {d.offlineMachines} offline</span>
          </p>
          <MachineTable rows={d.machines.slice(0, 7)} range={d.range} />
        </Panel>

        <Panel title="Live activity" href="/admin/transactions?range=7">
          <p className="text-sm -mt-3 mb-5 text-[var(--muted)]"><span className="font-bold vx-up">+{inr(d.todayRevenue)}</span> today</p>
          <VxTimeline
            items={d.activity.slice(0, 6).map((a) => ({
              id: a.id, icon: PAY_META[a.type].icon, color: PAY_META[a.type].color,
              title: `+${inr(a.amount, 2)} · ${a.machine}`, meta: `${PAY_META[a.type].label} · ${a.when}`,
            }))}
          />
        </Panel>
      </div>

      {/* Alerts · busiest days */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] gap-6">
        <div id="attention" className="scroll-mt-6">
        <Panel title="Needs attention" actions={d.attention.length > 0 ? <span className="dbx-count">{d.attention.length}</span> : undefined}>
          {d.attention.length === 0 ? (
            <div className="dbx-clear">
              <span><CheckCircle2 className="w-6 h-6" /></span>
              <p className="font-semibold text-[var(--fg)]">All clear</p>
              <p className="text-sm text-[var(--muted)]">Machines online, stocked, and every payment dispensed.</p>
            </div>
          ) : (
            <AlertList items={d.attention.map((a) => ({ ...a, icon: KIND_ICON[a.kind] }))} moreHref="/admin/machines" />
          )}
        </Panel>
        </div>
        <Panel title="Busiest days">
          <Radar axes={d.byWeekday} />
          <p className="text-xs text-center text-[var(--muted)] -mt-1">Revenue by weekday · last {d.range} days</p>
        </Panel>
      </div>
    </main>
  );
}

/** "Projects"-style table: machine · location · revenue · stock bar. */
export function MachineTable({ rows, range, showAssignee = false }: {
  rows: (MachineLite & { revenue: number; assignee?: string | null })[]; range: number; showAssignee?: boolean;
}) {
  if (rows.length === 0) return <p className="ui-empty-hint py-8 text-center">No machines yet</p>;
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="vx-table sm:min-w-[520px]">
        <thead>
          <tr>
            <th>Machine</th>
            <th className="hidden sm:table-cell">{showAssignee ? 'Assigned to' : 'Location'}</th>
            <th>Revenue · {range}d</th>
            <th className="w-[26%]">Stock</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => {
            const pct = m.stock != null && m.capacity ? Math.round(Math.max(0, Math.min(100, (m.stock / m.capacity) * 100))) : null;
            const initials = m.name.replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
            return (
              <tr key={m.id}>
                <td>
                  <span className="vx-cell-title">
                    <span className={`vx-avatar ${m.online ? '' : 'is-off'}`} title={m.online ? 'Online' : `Offline · seen ${m.lastSeen}`}>{initials}</span>
                    <span title={m.name}>
                      {m.name}
                      <small className="vx-cell-sub sm:hidden">{showAssignee ? m.assignee || 'Unassigned' : m.location || ''}</small>
                    </span>
                  </span>
                </td>
                <td className="hidden sm:table-cell text-[var(--muted)] max-w-[180px] truncate">{showAssignee ? m.assignee || '—' : m.location || '—'}</td>
                <td className="font-bold">{inr(m.revenue)}</td>
                <td>
                  <span className="vx-pct">{pct == null ? '—' : `${pct}%`}<span className="text-[var(--muted)] font-medium text-xs"> {m.stock != null ? `· ${m.stock}${m.capacity ? `/${m.capacity}` : ''}` : ''}</span></span>
                  <span className="vx-progress is-thick">
                    <span style={{ width: `${pct ?? 0}%`, background: pct != null && pct < 20 ? 'var(--danger)' : pct != null && pct < 40 ? 'var(--warning)' : undefined }} />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
