/**
 * Shared admin/customer UI kit — server-safe (no hooks), themed via CSS
 * variables so every piece works in light and dark mode.
 * Styles: `.ui-*` and `.db-*` in app/globals.css.
 */
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

export { AreaChart, Radar, RingStat, TopCard, smoothPath } from './charts';
import { smoothPath } from './charts';

export type Tone = 'peach' | 'butter' | 'sky' | 'lilac' | 'mint';

/* ── Layout ── */

export function PageHeader({
  eyebrow, title, subtitle, actions,
}: { eyebrow?: string; title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <header className="ui-pagehead">
      <div className="min-w-0">
        {eyebrow && <p className="ui-eyebrow">{eyebrow}</p>}
        <h1 className="ui-title">{title}</h1>
        {subtitle && <p className="ui-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="ui-actions">{actions}</div>}
    </header>
  );
}

export function Panel({
  title, href, hrefLabel = 'View all', actions, children, className = '', flush = false,
}: {
  title?: string; href?: string; hrefLabel?: string; actions?: React.ReactNode;
  children: React.ReactNode; className?: string; flush?: boolean;
}) {
  return (
    <section className={`ui-panel ${flush ? 'is-flush' : ''} ${className}`}>
      {(title || href || actions) && (
        <div className="ui-panel-head">
          {title && <h2 className="ui-panel-title">{title}</h2>}
          <div className="flex items-center gap-2">
            {actions}
            {href && (
              <Link href={href} className="db-viewall">
                {hrefLabel} <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>
      )}
      {children}
    </section>
  );
}

/* ── Stats ── */

export function StatTile({
  tone, icon: Icon, label, value, sub, spark,
}: { tone: Tone; icon: React.ElementType; label: string; value: string; sub?: string; spark?: number[] }) {
  // Reference-style KPI: big number, small caps label, coloured change line.
  // The first tile in a StatGrid is promoted to the indigo hero card via CSS.
  return (
    <div className={`db-tile db-tone-${tone}`}>
      <span className="db-tile-icon"><Icon className="w-4 h-4" /></span>
      <p className="db-tile-value">{value}</p>
      <p className="db-tile-label">{label}</p>
      {sub && <p className="db-tile-sub">{sub}</p>}
      {spark && spark.length > 1 && <Sparkline values={spark} />}
    </div>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="ui-statgrid">{children}</div>;
}

/* ── Bits ── */

export function StatusPill({ tone, children }: { tone: 'ok' | 'warn' | 'bad' | 'muted' | 'info'; children: React.ReactNode }) {
  return <span className={`ui-pill is-${tone}`}><span className="ui-pill-dot" />{children}</span>;
}

export function EmptyState({ icon: Icon, title, hint, action }: { icon: React.ElementType; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="ui-empty">
      <span className="ui-empty-icon"><Icon className="w-6 h-6" /></span>
      <p className="ui-empty-title">{title}</p>
      {hint && <p className="ui-empty-hint">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ── Charts (pure SVG) ── */

export function Sparkline({ values }: { values: number[] }) {
  const w = 120, h = 40, max = Math.max(...values, 1), min = Math.min(...values, 0);
  const pts = values.map((v, i): [number, number] => [(i / (values.length - 1)) * (w - 8) + 2, h - 6 - ((v - min) / (max - min || 1)) * (h - 14)]);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="ui-spark" preserveAspectRatio="none" aria-hidden="true">
      <path d={smoothPath(pts)} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Horizontal bar list — great for "top N" rankings. */
export function BarList({ items, format = (n) => String(n) }: { items: { label: string; value: number; sub?: string }[]; format?: (n: number) => string }) {
  if (items.length === 0) return <p className="ui-empty-hint py-6 text-center">No data yet</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="ui-list is-rank">
      {items.map((it, i) => (
        <li key={it.label} className="ui-row ui-row-rank">
          <span className="ui-rank">{i + 1}</span>
          <span className="min-w-0">
            <span className="ui-row-title" title={it.label}>{it.label}</span>
            <span className="cg-bar ui-rank-bar"><span style={{ width: `${(it.value / max) * 100}%` }} /></span>
          </span>
          <span className="ui-row-end is-stack">
            <span className="ui-row-num">{format(it.value)}</span>
            {it.sub && <span className="ui-row-meta">{it.sub}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Donut with legend. */
export function Donut({ slices, centerLabel, centerValue }: {
  slices: { label: string; value: number; color: string }[]; centerLabel?: string; centerValue?: string;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const R = 52, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="ui-donut">
      <svg viewBox="0 0 140 140" aria-hidden="true">
        <circle cx="70" cy="70" r={R} className="ui-donut-track" />
        {total > 0 && slices.map((s) => {
          const len = (s.value / total) * C;
          const el = (
            <circle key={s.label} cx="70" cy="70" r={R} fill="none" stroke={s.color} strokeWidth="16"
              strokeDasharray={`${Math.max(len - 2, 0)} ${C}`} strokeDashoffset={-acc} strokeLinecap="round"
              transform="rotate(-90 70 70)" />
          );
          acc += len;
          return el;
        })}
        {centerValue && (
          // Shrink long values (e.g. ₹2,73,580) so they stay inside the ring
          <text x="70" y="68" textAnchor="middle" className="ui-donut-value" style={{ fontSize: centerValue.length > 8 ? 14 : centerValue.length > 6 ? 16 : 20 }}>{centerValue}</text>
        )}
        {centerLabel && <text x="70" y="86" textAnchor="middle" className="ui-donut-label">{centerLabel}</text>}
      </svg>
      <ul className="ui-legend">
        {slices.map((s) => (
          <li key={s.label}>
            <span style={{ background: s.color }} />
            {s.label}
            <b>{total > 0 ? Math.round((s.value / total) * 100) : 0}%</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Bucket timestamped amounts into the last `days` days (oldest → newest), by India date. */
export function dailySeries(rows: { at: string; amount: number }[], days: number, now: number = Date.now()) {
  const DAY = 86_400_000;
  const istKey = (t: number) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
  const out: { label: string; value: number }[] = [];
  const idx = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const t = now - (days - 1 - i) * DAY;
    idx.set(istKey(t), i);
    out.push({ label: new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }), value: 0 });
  }
  for (const r of rows) {
    const i = idx.get(istKey(new Date(r.at).getTime()));
    if (i != null) out[i].value += r.amount;
  }
  return out;
}

export const inr = (n: number, dp = 0) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
