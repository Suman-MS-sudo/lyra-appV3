import Link from 'next/link';
import { AlertOctagon, ArrowRight, CheckCircle2, FileWarning, KeyRound, PackageOpen, WifiOff } from 'lucide-react';
import { Panel, RingStat, inr } from '@/components/ui/kit';

export interface GlanceMachine {
  id: string;
  name: string;
  location: string | null;
  online: boolean;
  stock: number | null;
  capacity: number | null;
  lastSeen: string;
  /** Team member this machine is assigned to (super customers only) */
  assignee?: string | null;
}

export interface GlanceAlert {
  level: 'critical' | 'warning';
  kind: 'offline' | 'stock' | 'rental' | 'invoice';
  title: string;
  detail: string;
  href: string;
}

const ICON: Record<GlanceAlert['kind'], React.ElementType> = { offline: WifiOff, stock: PackageOpen, rental: KeyRound, invoice: FileWarning };

function delta(cur: number, prev: number) {
  if (prev <= 0) return cur > 0 ? '▲ up from no sales yesterday' : 'no sales yet today';
  const p = Math.round(((cur - prev) / prev) * 100);
  return `${p >= 0 ? '▲' : '▼'} ${Math.abs(p)}% vs yesterday`;
}

/**
 * The customer's "at a glance" block: today's numbers, what needs action, and
 * every machine's live status + stock — the things a facility manager checks first.
 */
export function CustomerGlance({
  todayCount, todayRevenue, yesterdayRevenue, alerts, machines, showRevenue,
}: {
  todayCount: number; todayRevenue: number; yesterdayRevenue: number;
  alerts: GlanceAlert[]; machines: GlanceMachine[]; showRevenue: boolean;
}) {
  const online = machines.filter((m) => m.online).length;
  const stocked = machines.filter((m) => m.stock !== null && m.capacity);
  const stockTotal = stocked.reduce((t, m) => t + (m.stock || 0), 0);
  const capacityTotal = stocked.reduce((t, m) => t + (m.capacity || 0), 0);
  const needRefill = machines.filter((m) => m.stock !== null && m.stock < 5).length;
  const sorted = [...machines].sort((a, b) => Number(a.online) - Number(b.online) || (a.stock ?? 99) - (b.stock ?? 99));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] gap-5 mb-6">
      <div className="flex flex-col gap-5">
        {/* Today */}
        <section className="cg-today">
          <p className="cg-today-label">Today</p>
          <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
            <div>
              <p className="cg-today-value">{todayCount.toLocaleString('en-IN')}</p>
              <p className="cg-today-sub">payments / dispenses</p>
            </div>
            {showRevenue && (
              <div>
                <p className="cg-today-value">{inr(todayRevenue)}</p>
                <p className="cg-today-sub">{delta(todayRevenue, yesterdayRevenue)}</p>
              </div>
            )}
            <div>
              <p className="cg-today-value">{online}<span>/{machines.length}</span></p>
              <p className="cg-today-sub">machines online</p>
            </div>
          </div>
        </section>

        <RingStat label="Machines online" sub={machines.length - online ? `${machines.length - online} offline` : 'all connected'} value={online} max={Math.max(machines.length, 1)} tone={machines.length - online ? 'warn' : 'ok'} />
        {capacityTotal > 0 && (
          <RingStat label="Stock level" sub={needRefill ? `${needRefill} need refill` : 'healthy'} value={stockTotal} max={capacityTotal} tone={needRefill ? 'warn' : 'accent'} />
        )}

        {/* Needs attention */}
        <Panel title="Needs attention" actions={alerts.length > 0 ? <span className="dbx-count">{alerts.length}</span> : undefined}>
          {alerts.length === 0 ? (
            <div className="dbx-clear">
              <span><CheckCircle2 className="w-6 h-6" /></span>
              <p className="font-semibold text-[var(--fg)]">All clear</p>
              <p className="text-sm text-[var(--muted)]">Your machines are online and stocked.</p>
            </div>
          ) : (
            <ul className="dbx-alerts">
              {alerts.slice(0, 6).map((a, i) => {
                const Icon = a.level === 'critical' && a.kind === 'stock' ? AlertOctagon : ICON[a.kind];
                return (
                  <li key={i}>
                    <Link href={a.href} className={`dbx-alert is-${a.level}`}>
                      <span className="dbx-alert-icon"><Icon className="w-4 h-4" /></span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-[var(--fg)] truncate">{a.title}</span>
                        <span className="block text-xs text-[var(--muted)] truncate">{a.detail}</span>
                      </span>
                      <ArrowRight className="w-4 h-4 text-[var(--subtle)] shrink-0" />
                    </Link>
                  </li>
                );
              })}
              {alerts.length > 6 && <li className="text-xs text-[var(--muted)] pt-1 pl-1">+ {alerts.length - 6} more</li>}
            </ul>
          )}
        </Panel>
      </div>

      {/* Machines at a glance */}
      <Panel title="My machines at a glance" href="/customer/machines">
        {sorted.length === 0 ? (
          <p className="ui-empty-hint py-8 text-center">No machines assigned yet</p>
        ) : (
          <ul className="cg-machines">
            {sorted.slice(0, 8).map((m) => {
              const pct = m.stock != null && m.capacity ? Math.max(0, Math.min(100, (m.stock / m.capacity) * 100)) : null;
              const low = m.stock != null && m.stock < 5;
              return (
                <li key={m.id}>
                  <span className={`cg-dot ${m.online ? 'is-on' : 'is-off'}`} aria-label={m.online ? 'Online' : 'Offline'} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--fg)] truncate">{m.name}</p>
                      <p className={`text-xs font-semibold whitespace-nowrap ${m.stock === 0 ? 'text-[var(--danger)]' : low ? 'text-[var(--warning)]' : 'text-[var(--fg-2)]'}`}>
                        {m.stock == null ? '—' : `${m.stock}${m.capacity ? ` / ${m.capacity}` : ''} left`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="cg-bar"><span className={m.stock === 0 ? 'is-empty' : low ? 'is-low' : ''} style={{ width: `${pct ?? (m.stock && m.stock >= 5 ? 100 : 0)}%` }} /></span>
                      <span className="text-[11px] text-[var(--subtle)] whitespace-nowrap">{m.assignee ? `${m.assignee} · ` : ''}{m.online ? 'online' : `seen ${m.lastSeen}`}</span>
                    </div>
                  </div>
                </li>
              );
            })}
            {sorted.length > 8 && <li className="text-xs text-[var(--muted)] pl-6">+ {sorted.length - 8} more machines</li>}
          </ul>
        )}
      </Panel>
    </div>
  );
}
