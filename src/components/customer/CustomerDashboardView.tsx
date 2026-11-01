import {
  AlertOctagon, Banknote, Building2, CheckCircle2, FileWarning, KeyRound, PackageOpen, Receipt, Smile, Wallet, WifiOff, Zap,
} from 'lucide-react';
import { Panel, Radar, inr } from '@/components/ui/kit';
import { AlertList } from '@/components/ui/lists';
import { VxAreaChart, VxBars, VxGauge, VxKpi, VxMiniStat, VxRing, VxTimeline } from '@/components/ui/vision';
import { MachineTable, PAY_META, RangePills, delta, welcomeChips } from '@/components/admin/DashboardView';
import { FleetWelcome } from '@/components/ui/FleetWelcome';
import type { GlanceAlert, GlanceMachine } from '@/components/customer/CustomerGlance';

type Leader = { label: string; value: number; count: number };

export interface CustomerDashboardData {
  range: 7 | 14 | 30;
  firstName: string;
  todayRevenue: number;
  todayCount: number;
  yesterdayRevenue: number;
  yesterdayCount: number;
  trend: { label: string; value: number }[];
  trendUpi: number[];
  trendCount: number[];
  mix: { upi: number; coin: number; rfid: number };
  revenueByMachine: Record<string, number>;
  byWeekday: { label: string; value: number }[];
  tops: { machine: Leader; product: Leader; method: Leader };
  activity: { id: string; type: 'upi' | 'coin' | 'rfid'; machine: string; amount: number; when: string }[];
  machines: GlanceMachine[];
  alerts: GlanceAlert[];
  /** Super customers see who each machine is assigned to */
  showAssignee?: boolean;
}

const ALERT_ICON: Record<GlanceAlert['kind'], React.ElementType> = { offline: WifiOff, stock: PackageOpen, rental: KeyRound, invoice: FileWarning };
const RANGE_LABEL = { 7: '7d', 14: '2w', 30: '1m' } as const;

/** Customer dashboard: same console layout as admin, scoped to their machines. */
export function CustomerDashboardView(d: CustomerDashboardData) {
  const online = d.machines.filter((m) => m.online).length;
  const offline = d.machines.length - online;
  const stocked = d.machines.filter((m) => m.stock !== null && m.capacity);
  const stockTotal = stocked.reduce((t, m) => t + (m.stock || 0), 0);
  const capacityTotal = stocked.reduce((t, m) => t + (m.capacity || 0), 0);
  const needRefill = d.machines.filter((m) => m.stock !== null && m.stock < 5).length;
  const onlinePct = d.machines.length ? (online / d.machines.length) * 100 : 0;
  const stockPct = capacityTotal ? (stockTotal / capacityTotal) * 100 : 0;
  const rangeTotal = d.trend.reduce((s, t) => s + t.value, 0);
  const rangeCount = d.trendCount.reduce((s, n) => s + n, 0);
  const mixTotal = d.mix.upi + d.mix.coin + d.mix.rfid;
  const critical = d.alerts.filter((a) => a.level === 'critical').length;
  const csv = 'Day,Revenue (INR),UPI (INR),Payments\n' + d.trend.map((t, i) => `${t.label},${t.value.toFixed(2)},${(d.trendUpi[i] || 0).toFixed(2)},${d.trendCount[i] || 0}`).join('\n');
  const rows = d.machines
    .map((m) => ({ ...m, revenue: d.revenueByMachine[m.name] || 0 }))
    .sort((a, b) => b.revenue - a.revenue || Number(b.online) - Number(a.online));

  return (
    <div className="flex flex-col gap-6">
      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <VxKpi label="Today's revenue" value={inr(d.todayRevenue)} change={delta(d.todayRevenue, d.yesterdayRevenue)} icon={Wallet} />
        <VxKpi label="Payments today" value={d.todayCount.toLocaleString('en-IN')} change={delta(d.todayCount, d.yesterdayCount)} icon={Receipt} />
        <VxKpi label="Machines online" value={`${online}/${d.machines.length}`} change={offline ? { text: `${offline} off`, up: false } : { text: 'all', up: true }} icon={Building2} />
        <VxKpi label={`Revenue · last ${d.range} days`} value={inr(rangeTotal)} change={{ text: `${rangeCount}`, up: true }} icon={Banknote} />
      </div>

      {/* Welcome · gauge · score */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.85fr)_minmax(0,1.15fr)] gap-6">
        <FleetWelcome
          name={d.firstName}
          revenue={inr(d.todayRevenue)}
          payments={d.todayCount}
          change={delta(d.todayRevenue, d.yesterdayRevenue)}
          chips={welcomeChips(critical, offline, needRefill)}
          href="#transactions"
          linkLabel="View transactions"
          fleet={d.machines.map((m) => ({ id: m.id, name: m.name, online: m.online }))}
        />
        <Panel title="Machines online">
          <p className="text-xs -mt-3 mb-2 text-[var(--muted)]">{d.showAssignee ? 'Across your company' : 'Your machines'}</p>
          <VxGauge pct={onlinePct} icon={Smile} caption={`${online} of ${d.machines.length} reporting`} />
        </Panel>
        <Panel title="Stock health" className="lg:col-span-2 xl:col-span-1">
          <div className="vx-score">
            <div>
              <div className="vx-inner vx-score-stat"><p>Need refill</p><strong>{needRefill} machine{needRefill === 1 ? '' : 's'}</strong></div>
              <div className="vx-inner vx-score-stat"><p>Offline</p><strong>{offline} machine{offline === 1 ? '' : 's'}</strong></div>
            </div>
            <VxRing pct={stockPct} value={stockTotal.toLocaleString('en-IN')} label="Stock left" tone={stockPct < 25 ? 'bad' : stockPct < 50 ? 'warn' : 'ok'} />
          </div>
        </Panel>
      </div>

      {/* Sales overview · payments */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] gap-6">
        <Panel title="Sales overview" actions={<RangePills range={d.range} csv={csv} file={`lyra-sales-${RANGE_LABEL[d.range]}.csv`} />}>
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
            <VxMiniStat icon={Zap} label="Online" value={`${online}/${d.machines.length}`} pct={onlinePct} />
          </div>
        </Panel>
      </div>

      {/* Machines · live activity */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] gap-6">
        <Panel title={d.showAssignee ? 'Company machines' : 'My machines'} href={d.showAssignee ? '/customer/machines' : undefined}>
          <p className="text-sm -mt-3 mb-3 text-[var(--muted)] flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
            <span><b className="text-[var(--fg)]">{online} online</b> · {offline} offline</span>
          </p>
          <MachineTable rows={rows.slice(0, 7)} range={d.range} showAssignee={d.showAssignee} />
          {rows.length > 7 && <p className="text-xs mt-3 text-[var(--muted)]">Showing top 7 of {rows.length} by revenue</p>}
        </Panel>

        <Panel title="Live activity">
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
        <Panel title="Needs attention" actions={d.alerts.length > 0 ? <span className="dbx-count">{d.alerts.length}</span> : undefined}>
          {d.alerts.length === 0 ? (
            <div className="dbx-clear">
              <span><CheckCircle2 className="w-6 h-6" /></span>
              <p className="font-semibold text-[var(--fg)]">All clear</p>
              <p className="text-sm text-[var(--muted)]">Your machines are online and stocked.</p>
            </div>
          ) : (
            <AlertList
              items={d.alerts.map((a) => ({ ...a, icon: a.level === 'critical' && a.kind === 'stock' ? AlertOctagon : ALERT_ICON[a.kind] }))}
              moreHref={d.showAssignee ? '/customer/machines' : undefined}
            />
          )}
        </Panel>
        </div>
        <Panel title="Busiest days">
          <Radar axes={d.byWeekday} />
          <p className="text-xs text-center text-[var(--muted)] -mt-1">Revenue by weekday · last {d.range} days</p>
        </Panel>
      </div>
    </div>
  );
}
