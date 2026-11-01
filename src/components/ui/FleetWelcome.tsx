import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { IST_OFFSET_MS } from '@/lib/time';

export interface FleetBlip { id: string; name: string; online: boolean }
export interface WelcomeChip { label: string; tone: 'bad' | 'ok' | 'warn'; href?: string }

// Clock read lives outside the component (render must stay pure)
function istNow() {
  const now = new Date(Date.now() + IST_OFFSET_MS);
  const h = now.getUTCHours();
  return {
    greeting: h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening',
    date: now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }),
  };
}

/** Stable pseudo-random 0..1 from a string, so each machine keeps its spot on the radar. */
function hash01(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

/**
 * Welcome card with a live "fleet radar": every machine is a blip (online = glowing, offline = red),
 * a sweep rotates over them, and the centre shows how many are reporting.
 */
export function FleetWelcome({ name, revenue, payments, change, chips, href, linkLabel, fleet }: {
  name: string;
  revenue: string;
  payments: number;
  change?: { text: string; up: boolean };
  chips: WelcomeChip[];
  href: string;
  linkLabel: string;
  fleet: FleetBlip[];
}) {
  const { greeting, date } = istNow();
  const online = fleet.filter((m) => m.online).length;
  const R = 100;
  // Online machines sit on the inner rings, offline ones drift to the edge
  const blips = fleet.slice(0, 120).map((m) => {
    const a = hash01(m.id) * Math.PI * 2;
    const ring = m.online ? 0.32 + hash01(m.id + 'r') * 0.45 : 0.8 + hash01(m.id + 'r') * 0.14;
    return { ...m, x: Math.cos(a) * R * ring, y: Math.sin(a) * R * ring, delay: (a / (Math.PI * 2)) * 4 };
  });

  return (
    <section className="vx-card vx-welcome">
      <div className="vx-welcome-copy">
        <p className="vx-welcome-date">{date}</p>
        <h2 className="vx-welcome-name">{greeting},<br />{name}</h2>

        <div className="vx-welcome-today">
          <span className="vx-welcome-amount">{revenue}</span>
          {change && <span className={`vx-welcome-delta ${change.up ? 'is-up' : 'is-down'}`}>{change.up ? '▲' : '▼'} {change.text.replace(/^[+-]/, '')}</span>}
          <p>today · {payments.toLocaleString('en-IN')} payment{payments === 1 ? '' : 's'}</p>
        </div>

        <div className="vx-welcome-chips">
          {chips.map((c) => {
            const inner = <><i />{c.label}</>;
            return c.href
              ? <Link key={c.label} href={c.href} className={`vx-chip is-${c.tone}`}>{inner}</Link>
              : <span key={c.label} className={`vx-chip is-${c.tone}`}>{inner}</span>;
          })}
        </div>

        <Link href={href} className="vx-welcome-cta">{linkLabel} <ArrowRight className="w-3.5 h-3.5" /></Link>
      </div>

      <div className="vx-radar" aria-label={`${online} of ${fleet.length} machines online`} role="img">
        <svg viewBox="-110 -110 220 220" aria-hidden="true">
          <defs>
            <radialGradient id="vx-radar-bg">
              <stop offset="0%" stopColor="#0075ff" stopOpacity="0.28" />
              <stop offset="70%" stopColor="#0075ff" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#0075ff" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle r={R} fill="url(#vx-radar-bg)" />
          {[0.33, 0.66, 1].map((k) => <circle key={k} r={R * k} className="vx-radar-ring" />)}
          <line x1={-R} x2={R} y1="0" y2="0" className="vx-radar-ring" />
          <line y1={-R} y2={R} x1="0" x2="0" className="vx-radar-ring" />
          {blips.map((b) => (
            <g key={b.id} transform={`translate(${b.x.toFixed(1)} ${b.y.toFixed(1)})`}>
              <title>{`${b.name} · ${b.online ? 'online' : 'offline'}`}</title>
              {b.online && <circle r="6" className="vx-blip-halo" style={{ animationDelay: `${b.delay.toFixed(2)}s` }} />}
              <circle r={b.online ? 2.6 : 2.2} className={b.online ? 'vx-blip' : 'vx-blip is-off'} />
            </g>
          ))}
        </svg>
        <span className="vx-radar-sweep" aria-hidden="true" />
        <div className="vx-radar-core">
          <strong>{online}<small>/{fleet.length}</small></strong>
          <span>online</span>
        </div>
      </div>
    </section>
  );
}
