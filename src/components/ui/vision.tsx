/**
 * Dashboard building blocks for the console look (pure SVG, server-safe):
 * KPI card, semicircle gauge, score ring, two-series area chart, bars-in-a-box, mini stat, timeline.
 */
import { smoothPath } from '@/components/ui/charts';

type Pt = [number, number];

export function VxKpi({ label, value, change, icon: Icon }: {
  label: string; value: string; change?: { text: string; up: boolean }; icon: React.ElementType;
}) {
  return (
    <div className="vx-card vx-kpi">
      <div className="min-w-0">
        <p className="vx-kpi-label">{label}</p>
        <p className="vx-kpi-value">
          {value}
          {change && <small className={change.up ? 'vx-up' : 'vx-down'}>{change.text}</small>}
        </p>
      </div>
      <span className="vx-iconsq"><Icon className="w-5 h-5" /></span>
    </div>
  );
}

/** Semicircle gauge (0–100%) with a face icon and a readout plate underneath. */
export function VxGauge({ pct, icon: Icon, caption }: { pct: number; icon: React.ElementType; caption: string }) {
  const p = Math.max(0, Math.min(1, pct / 100));
  const R = 80, cx = 100, cy = 96;
  const arc = (t: number) => {
    const a = Math.PI + t * Math.PI;
    return [cx + Math.cos(a) * R, cy + Math.sin(a) * R];
  };
  const [sx, sy] = arc(0), [ex, ey] = arc(1), [px, py] = arc(p);
  return (
    <>
      <div className="vx-gauge">
        <svg viewBox="0 0 200 110" aria-hidden="true">
          <defs>
            <linearGradient id="vx-gauge-grad" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#0075ff" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#0075ff" />
            </linearGradient>
          </defs>
          <path d={`M${sx},${sy} A${R},${R} 0 0 1 ${ex},${ey}`} className="vx-gauge-track" />
          {p > 0 && <path d={`M${sx},${sy} A${R},${R} 0 0 1 ${px.toFixed(1)},${py.toFixed(1)}`} className="vx-gauge-fill" stroke="url(#vx-gauge-grad)" />}
        </svg>
        <span className="vx-gauge-face"><Icon className="w-5 h-5" /></span>
      </div>
      <div className="vx-gauge-readout vx-inner">
        <small>0%</small>
        <p><strong>{Math.round(p * 100)}%</strong><span>{caption}</span></p>
        <small>100%</small>
      </div>
    </>
  );
}

/** Big ring with a centred score. */
export function VxRing({ pct, value, label, tone = 'ok' }: { pct: number; value: string; label: string; tone?: 'ok' | 'warn' | 'bad' }) {
  const p = Math.max(0, Math.min(1, pct / 100));
  const R = 70, C = 2 * Math.PI * R;
  const color = tone === 'ok' ? '#05cd99' : tone === 'warn' ? '#ffb547' : '#ff4d4d';
  return (
    <div className="vx-ring">
      <svg viewBox="0 0 168 168" aria-hidden="true">
        <defs>
          <linearGradient id={`vx-ring-${tone}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
        <circle cx="84" cy="84" r={R} className="vx-ring-track" />
        <circle cx="84" cy="84" r={R} className="vx-ring-fill" stroke={`url(#vx-ring-${tone})`} strokeDasharray={`${p * C} ${C}`} />
      </svg>
      <div className="vx-ring-center">
        <small>{label}</small>
        <strong>{value}</strong>
        <small>{Math.round(p * 100)}%</small>
      </div>
    </div>
  );
}

function niceMax(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(v, 1))));
  for (const k of [1, 2, 2.5, 5, 10]) if (k * p >= v) return k * p;
  return 10 * p;
}

/** Two smooth filled series over shared x labels. */
export function VxAreaChart({ labels, series, format = (n) => String(Math.round(n)), height = 260 }: {
  labels: string[];
  series: { name: string; values: number[]; color: string }[];
  format?: (n: number) => string;
  height?: number;
}) {
  if (labels.length === 0) return <p className="ui-empty-hint py-10 text-center">No data yet</p>;
  const W = 640, H = height, padL = 44, padB = 26, padT = 12;
  const nice = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const x = (i: number) => padL + (labels.length === 1 ? (W - padL) / 2 : (i / (labels.length - 1)) * (W - padL - 8));
  const y = (v: number) => padT + (1 - v / nice) * (H - padT - padB);
  const every = Math.max(1, Math.ceil(labels.length / 10));
  return (
    <div className="vx-area">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Trend chart">
        <defs>
          {series.map((s, i) => (
            <linearGradient key={i} id={`vx-area-${i}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={i === 0 ? 0.55 : 0.35} />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {[0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(t * nice)} y2={y(t * nice)} className="vx-area-grid" />
            <text x={padL - 8} y={y(t * nice) + 3} textAnchor="end" className="vx-area-axis is-y">{format(t * nice)}</text>
          </g>
        ))}
        {series.map((s, i) => {
          const pts: Pt[] = s.values.map((v, j) => [x(j), y(v)]);
          const line = smoothPath(pts);
          const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${H - padB} L${pts[0][0].toFixed(1)},${H - padB} Z`;
          return (
            <g key={s.name}>
              <path d={area} fill={`url(#vx-area-${i})`} />
              <path d={line} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" />
            </g>
          );
        })}
        {labels.map((l, i) => (
          <g key={i}>
            <rect x={x(i) - 10} y={padT} width="20" height={H - padT - padB} fill="transparent">
              <title>{`${l}: ${series.map((s) => `${s.name} ${format(s.values[i] || 0)}`).join(' · ')}`}</title>
            </rect>
            {i % every === 0 && <text x={x(i)} y={H - 6} textAnchor="middle" className="vx-area-axis">{l}</text>}
          </g>
        ))}
      </svg>
    </div>
  );
}

/** Thin rounded bars inside a dark inner box. */
export function VxBars({ values, labels, format = (n) => String(Math.round(n)) }: { values: number[]; labels: string[]; format?: (n: number) => string }) {
  const W = 400, H = 190, padL = 30, padB = 18, padT = 8;
  const nice = niceMax(Math.max(1, ...values));
  const slot = (W - padL) / Math.max(values.length, 1);
  const bw = Math.min(8, slot * 0.4);
  return (
    <div className="vx-inner vx-bars">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Bar chart">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <text key={t} x={0} y={padT + (1 - t) * (H - padT - padB) + 3} className="vx-axis">{format(t * nice)}</text>
        ))}
        {values.map((v, i) => {
          const h = (v / nice) * (H - padT - padB);
          return (
            <rect key={i} x={padL + i * slot + (slot - bw) / 2} y={H - padB - h} width={bw} height={Math.max(h, v > 0 ? 2 : 0)} rx={bw / 2} className="vx-bar">
              <title>{`${labels[i]}: ${format(v)}`}</title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
}

export function VxMiniStat({ icon: Icon, label, value, pct }: { icon: React.ElementType; label: string; value: string; pct: number }) {
  return (
    <div className="min-w-0">
      <p className="vx-mini-head"><span className="vx-iconsq is-sm"><Icon className="w-3.5 h-3.5" /></span>{label}</p>
      <p className="vx-mini-value">{value}</p>
      <span className="vx-progress"><span style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></span>
    </div>
  );
}

export function VxTimeline({ items }: { items: { id: string; icon: React.ElementType; title: string; meta: string; color?: string }[] }) {
  if (items.length === 0) return <p className="ui-empty-hint py-8 text-center">Nothing yet</p>;
  return (
    <ul className="vx-timeline">
      {items.map((it) => (
        <li key={it.id}>
          <span className="vx-timeline-dot" style={it.color ? { color: it.color } : undefined}><it.icon className="w-4 h-4" /></span>
          <div className="min-w-0">
            <p className="vx-timeline-title truncate">{it.title}</p>
            <p className="vx-timeline-meta">{it.meta}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
