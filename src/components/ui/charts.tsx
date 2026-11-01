/**
 * Chart primitives (pure SVG, server-safe): smooth area chart with a peak
 * callout, progress-ring stat, radar, and "top N" cards. Re-exported from kit.tsx.
 */

type Pt = [number, number];

/** Smooth path through points (monotone cubic — never overshoots below 0). */
export function smoothPath(pts: Pt[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;
  const n = pts.length;
  const dx = (i: number) => pts[i + 1][0] - pts[i][0];
  const slope = (i: number) => (pts[i + 1][1] - pts[i][1]) / (dx(i) || 1);
  const m: number[] = new Array(n);
  m[0] = slope(0);
  m[n - 1] = slope(n - 2);
  for (let i = 1; i < n - 1; i++) {
    const a = slope(i - 1), b = slope(i);
    m[i] = a * b <= 0 ? 0 : (a + b) / 2;
  }
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx(i) / 3;
    d += ` C${(pts[i][0] + h).toFixed(1)},${(pts[i][1] + m[i] * h).toFixed(1)} ${(pts[i + 1][0] - h).toFixed(1)},${(pts[i + 1][1] - m[i + 1] * h).toFixed(1)} ${pts[i + 1][0].toFixed(1)},${pts[i + 1][1].toFixed(1)}`;
  }
  return d;
}

function niceMax(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const k of [1, 2, 2.5, 5, 10]) if (k * p >= v) return k * p;
  return 10 * p;
}

/** Smooth area chart with gridlines, x labels and a callout on the peak point. */
export function AreaChart({
  points, height = 230, format = (n) => String(Math.round(n)), peakLabel = 'Peak',
}: { points: { label: string; value: number }[]; height?: number; format?: (n: number) => string; peakLabel?: string }) {
  if (points.length === 0) return <p className="ui-empty-hint py-10 text-center">No data yet</p>;
  const W = 640, H = height, padL = 44, padB = 26, padT = 34;
  const max = Math.max(...points.map((p) => p.value), 1);
  const nice = niceMax(max);
  const x = (i: number) => padL + (points.length === 1 ? (W - padL) / 2 : (i / (points.length - 1)) * (W - padL - 12));
  const y = (v: number) => padT + (1 - v / nice) * (H - padT - padB);
  const pts: Pt[] = points.map((p, i) => [x(i), y(p.value)]);
  const line = smoothPath(pts);
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${H - padB} L${pts[0][0].toFixed(1)},${H - padB} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * nice);
  const every = Math.max(1, Math.ceil(points.length / 8));
  const peak = points.reduce((best, p, i) => (p.value > points[best].value ? i : best), 0);
  const hasPeak = points[peak].value > 0;
  const [px, py] = pts[peak];
  const calloutW = 104;
  const cx = Math.min(Math.max(px - calloutW / 2, padL), W - calloutW);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="ui-chart" role="img" aria-label="Trend chart">
      <defs>
        <linearGradient id="ui-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" className="ui-area-top" />
          <stop offset="100%" className="ui-area-bottom" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W} y1={y(t)} y2={y(t)} className="ui-grid" />
          <text x={padL - 8} y={y(t) + 4} textAnchor="end" className="ui-axis">{format(t)}</text>
        </g>
      ))}
      {hasPeak && <rect x={px - 14} y={padT} width="28" height={H - padT - padB} rx="8" className="ui-peak-band" />}
      <path d={area} fill="url(#ui-area)" />
      <path d={line} fill="none" className="ui-line" strokeWidth="2.75" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={pts[i][0]} cy={pts[i][1]} r="9" fill="transparent"><title>{`${p.label}: ${format(p.value)}`}</title></circle>
          {i % every === 0 && <text x={pts[i][0]} y={H - 6} textAnchor="middle" className="ui-axis">{p.label}</text>}
        </g>
      ))}
      {hasPeak && (
        <g>
          <circle cx={px} cy={py} r="5.5" className="ui-dot" />
          <rect x={cx} y={Math.max(py - 40, 2)} width={calloutW} height="26" rx="8" className="ui-callout" />
          <text x={cx + calloutW / 2} y={Math.max(py - 40, 2) + 17} textAnchor="middle" className="ui-callout-text">
            {peakLabel} · {format(points[peak].value)}
          </text>
        </g>
      )}
    </svg>
  );
}

/** Stat card with a progress ring (the "Online visitors 312 / max 512" card). */
export function RingStat({ label, value, max, sub, tone = 'accent' }: {
  label: string; value: number; max: number; sub?: string; tone?: 'accent' | 'ok' | 'warn' | 'bad';
}) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const R = 22, C = 2 * Math.PI * R;
  return (
    <div className="ui-ring">
      <div className="min-w-0">
        <p className="ui-ring-label">{label}</p>
        {sub && <p className="ui-ring-sub">{sub}</p>}
      </div>
      <svg viewBox="0 0 56 56" className={`ui-ring-svg is-${tone}`} aria-hidden="true">
        <circle cx="28" cy="28" r={R} className="ui-ring-track" />
        <circle cx="28" cy="28" r={R} className="ui-ring-fill" strokeDasharray={`${pct * C} ${C}`} transform="rotate(-90 28 28)" />
        <text x="28" y="32" textAnchor="middle" className="ui-ring-pct">{Math.round(pct * 100)}%</text>
      </svg>
      <div className="text-right">
        <p className="ui-ring-max">OF {max.toLocaleString('en-IN')}</p>
        <p className="ui-ring-value">{value.toLocaleString('en-IN')}</p>
      </div>
    </div>
  );
}

/** Radar chart (e.g. revenue by weekday). */
export function Radar({ axes }: { axes: { label: string; value: number }[] }) {
  const N = axes.length, cx = 130, cy = 120, R = 86;
  const max = Math.max(...axes.map((a) => a.value), 1);
  const ang = (i: number) => -Math.PI / 2 + (i / N) * 2 * Math.PI;
  const at = (i: number, r: number): Pt => [cx + Math.cos(ang(i)) * r, cy + Math.sin(ang(i)) * r];
  const shape = axes.map((a, i) => at(i, Math.max(0.06, a.value / max) * R));
  const peak = axes.reduce((b, a, i) => (a.value > axes[b].value ? i : b), 0);
  return (
    <svg viewBox="0 0 260 250" className="ui-radar" role="img" aria-label="Radar chart">
      {[0.25, 0.5, 0.75, 1].map((k) => (
        <polygon key={k} points={axes.map((_, i) => at(i, R * k).join(',')).join(' ')} className="ui-radar-grid" />
      ))}
      {axes.map((_, i) => {
        const [x2, y2] = at(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x2} y2={y2} className="ui-radar-grid" />;
      })}
      <polygon points={shape.map((p) => p.join(',')).join(' ')} className="ui-radar-shape" />
      {shape.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === peak ? 4.5 : 3} className={i === peak ? 'ui-dot' : 'ui-radar-dot'} />)}
      {axes.map((a, i) => {
        const [x, y] = at(i, R + 18);
        return <text key={a.label} x={x} y={y + 4} textAnchor="middle" className={`ui-axis ${i === peak ? 'ui-radar-peak' : ''}`}>{a.label}</text>;
      })}
    </svg>
  );
}

/** "Top platform"-style card. */
export function TopCard({ icon: Icon, eyebrow, title, value, unit, tone = 'sky' }: {
  icon: React.ElementType; eyebrow: string; title: string; value: string; unit?: string; tone?: 'peach' | 'butter' | 'sky' | 'lilac' | 'mint';
}) {
  return (
    <div className="ui-topcard">
      <div className="flex items-center gap-3 min-w-0">
        <span className={`db-row-icon db-tone-${tone}`}><Icon className="w-[18px] h-[18px]" /></span>
        <div className="min-w-0">
          <p className="ui-topcard-eyebrow">{eyebrow}</p>
          <p className="ui-topcard-title truncate" title={title}>{title}</p>
        </div>
      </div>
      <p className="ui-topcard-value">{value}{unit && <span> / {unit}</span>}</p>
    </div>
  );
}
