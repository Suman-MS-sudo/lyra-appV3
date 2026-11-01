/**
 * Dashboard list rows (alerts, payment feed, machine status) laid out on a fixed column grid
 * so icons, names and right-hand figures line up like a table. Shared by admin + customer views.
 */
import Link from 'next/link';
import { ArrowRight, ChevronRight, Coins, CreditCard, Nfc } from 'lucide-react';
import { inr } from '@/components/ui/kit';

/** "View all 26 →" footer under a truncated list. */
function ListMore({ href, total, noun }: { href?: string; total: number; noun: string }) {
  const text = `View all ${total.toLocaleString('en-IN')} ${noun}`;
  return href ? (
    <Link href={href} className="ui-list-more">{text} <ArrowRight className="w-3.5 h-3.5" /></Link>
  ) : (
    <p className="ui-list-more">{text}</p>
  );
}

export interface AlertItem {
  level: 'critical' | 'warning';
  icon: React.ElementType;
  title: string;
  detail: string;
  href: string;
}

export function AlertList({ items, limit = 6, moreHref }: { items: AlertItem[]; limit?: number; moreHref?: string }) {
  return (
    <>
      <ul className="ui-list">
        {items.slice(0, limit).map((a, i) => (
          <li key={i}>
            <Link href={a.href} className={`ui-row ui-row-alert is-${a.level}`}>
              <span className="ui-row-icon"><a.icon className="w-4 h-4" /></span>
              <span className="min-w-0">
                <span className="ui-row-title">{a.title}</span>
                <span className="ui-row-meta">{a.detail}</span>
              </span>
              <span className="ui-row-end">
                <span className={`ui-tag is-${a.level}`}>{a.level === 'critical' ? 'Critical' : 'Warning'}</span>
                <ChevronRight className="w-4 h-4 text-[var(--subtle)]" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {items.length > limit && <ListMore href={moreHref} total={items.length} noun="alerts" />}
    </>
  );
}

const PAY_TYPE = {
  upi: { label: 'UPI', icon: CreditCard, tone: 'sky' },
  coin: { label: 'Coin', icon: Coins, tone: 'butter' },
  rfid: { label: 'RFID', icon: Nfc, tone: 'peach' },
} as const;

export interface FeedItem { id: string; type: keyof typeof PAY_TYPE; machine: string; amount: number; when: string }

export function ActivityFeed({ items, moreHref }: { items: FeedItem[]; moreHref?: string }) {
  if (items.length === 0) return <p className="ui-empty-hint py-8 text-center">No payments yet</p>;
  return (
    <>
      <div className="ui-list-head ui-row-feed"><span /><span>Machine</span><span className="text-right">Amount</span></div>
      <ul className="ui-list">
        {items.map((a) => {
          const T = PAY_TYPE[a.type];
          return (
            <li key={a.id} className="ui-row ui-row-feed">
              <span className={`db-row-icon ui-row-icon db-tone-${T.tone}`}><T.icon className="w-4 h-4" /></span>
              <span className="min-w-0">
                <span className="ui-row-title">{a.machine}</span>
                <span className="ui-row-meta">{T.label}</span>
              </span>
              <span className="ui-row-end is-stack">
                <span className="ui-row-num text-[var(--success)]">+{inr(a.amount, 2)}</span>
                <span className="ui-row-meta">{a.when}</span>
              </span>
            </li>
          );
        })}
      </ul>
      {moreHref && <Link href={moreHref} className="ui-list-more">All transactions <ArrowRight className="w-3.5 h-3.5" /></Link>}
    </>
  );
}

export interface MachineRow {
  id: string;
  name: string;
  online: boolean;
  stock: number | null;
  capacity: number | null;
  lastSeen: string;
  assignee?: string | null;
}

export function MachineList({ items, limit = 6, moreHref }: { items: MachineRow[]; limit?: number; moreHref?: string }) {
  if (items.length === 0) return <p className="ui-empty-hint py-6 text-center">No machines assigned yet</p>;
  return (
    <>
      <div className="ui-list-head ui-row-machine"><span /><span>Machine</span><span className="text-right">Stock</span></div>
      <ul className="ui-list">
        {items.slice(0, limit).map((m) => {
          const pct = m.stock != null && m.capacity ? Math.max(0, Math.min(100, (m.stock / m.capacity) * 100)) : m.stock && m.stock >= 5 ? 100 : 0;
          const tone = m.stock === 0 ? 'is-empty' : m.stock != null && m.stock < 5 ? 'is-low' : '';
          return (
            <li key={m.id} className="ui-row ui-row-machine">
              <span className={`cg-dot ${m.online ? 'is-on' : 'is-off'}`} aria-label={m.online ? 'Online' : 'Offline'} />
              <span className="min-w-0">
                <span className="ui-row-title" title={m.name}>{m.name}</span>
                <span className="ui-row-meta">{m.assignee ? `${m.assignee} · ` : ''}{m.online ? 'online now' : `seen ${m.lastSeen}`}</span>
              </span>
              <span className="ui-row-end is-stack">
                <span className={`ui-row-num ${tone === 'is-empty' ? 'text-[var(--danger)]' : tone ? 'text-[var(--warning)]' : ''}`}>
                  {m.stock == null ? '—' : m.stock}
                  {m.stock != null && m.capacity ? <span className="ui-row-of">/{m.capacity}</span> : null}
                </span>
                <span className="cg-bar ui-row-bar"><span className={tone} style={{ width: `${pct}%` }} /></span>
              </span>
            </li>
          );
        })}
      </ul>
      {items.length > limit && <ListMore href={moreHref} total={items.length} noun="machines" />}
    </>
  );
}
