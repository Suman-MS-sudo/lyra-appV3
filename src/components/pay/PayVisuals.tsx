'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

const NAPKIN_IMAGE = '/icons/napkin-image.png';

/** Gentle tap feedback on phones that support it (Android Chrome). */
export function haptic(ms = 8) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* unsupported — ignore */
  }
}

/**
 * The product, shown as many times as the customer is buying: one napkin,
 * or two/three fanned out. Always renders three so changes animate smoothly.
 */
export function ProductFan({ count, imageUrl, dimmed }: { count: number; imageUrl?: string; dimmed?: boolean }) {
  const slots = [0, 1, 2];
  const tiltRef = useRef<HTMLDivElement>(null);

  // 3D tilt: follows the phone's gyroscope (Android) or the pointer (desktop).
  // iOS needs an explicit permission prompt for motion, so it simply floats there.
  useEffect(() => {
    const el = tiltRef.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const set = (x: number, y: number) => {
      el.style.setProperty('--ry', `${(x * 14).toFixed(2)}deg`);
      el.style.setProperty('--rx', `${(-y * 10).toFixed(2)}deg`);
    };
    const onMove = (e: PointerEvent) => set(e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5);
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      set(Math.max(-1, Math.min(1, e.gamma / 30)) / 2, Math.max(-1, Math.min(1, (e.beta - 45) / 30)) / 2);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('deviceorientation', onTilt);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('deviceorientation', onTilt);
    };
  }, []);

  return (
    <div className={`pf-fan ${dimmed ? 'is-dimmed' : ''}`} aria-hidden="true">
      <span className="pf-fan-glow" />
      {/* Tiny sparkles that twinkle in and out around the product */}
      {SPARKS.map((p, i) => (
        <svg key={i} className="pf-spark" viewBox="0 0 20 20" style={{ left: p.x, top: p.y, width: p.s, height: p.s, animationDelay: p.d }}>
          <path d="M10 0 C11 7 13 9 20 10 C13 11 11 13 10 20 C9 13 7 11 0 10 C7 9 9 7 10 0 Z" />
        </svg>
      ))}
      <div className="pf-fan-tilt" ref={tiltRef}>
      <div className="pf-fan-float">
        {slots.map((i) => {
          const visible = i < count;
          const offset = visible ? i - (count - 1) / 2 : 0; // −1 … +1 around the centre
          const style = {
            transform: `translate(-50%, -50%) translateX(${offset * 46}px) translateY(${Math.abs(offset) * 8}px) rotate(${offset * 14}deg) scale(${visible ? 1 - Math.abs(offset) * 0.06 : 0.6})`,
            opacity: visible ? 1 : 0,
            zIndex: 10 - Math.round(Math.abs(offset) * 2),
            transitionDelay: `${i * 40}ms`,
          };
          return imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={imageUrl} alt="" className="pf-fan-item pf-fan-photo" style={style} />
          ) : (
            <Image key={i} src={NAPKIN_IMAGE} alt="" width={987} height={899} className="pf-fan-item" style={style} priority={i === 0} />
          );
        })}
      </div>
      </div>
      <span className="pf-fan-floor" style={{ width: `${120 + (count - 1) * 60}px` }} />
    </div>
  );
}

const SPARKS = [
  { x: '14%', y: '22%', s: 12, d: '0s' },
  { x: '82%', y: '16%', s: 9, d: '1.3s' },
  { x: '88%', y: '62%', s: 13, d: '2.4s' },
  { x: '8%', y: '68%', s: 8, d: '3.1s' },
  { x: '58%', y: '4%', s: 7, d: '0.7s' },
];

/** Success mark: the tick draws itself on, rings ripple out, particles burst once. */
export function SuccessMark() {
  const particles = Array.from({ length: 14 }, (_, i) => i);
  return (
    <div className="sm" aria-hidden="true">
      <span className="sm-ring sm-ring-1" />
      <span className="sm-ring sm-ring-2" />
      {particles.map((i) => (
        <span
          key={i}
          className={`sm-dot ${i % 3 === 0 ? 'is-blue' : ''}`}
          style={{ transform: `rotate(${(360 / particles.length) * i}deg)`, animationDelay: `${0.25 + (i % 4) * 0.03}s` }}
        />
      ))}
      <svg className="sm-svg" viewBox="0 0 120 120">
        <circle className="sm-disc" cx="60" cy="60" r="46" />
        <path className="sm-tick" d="M40 61 L54 75 L81 46" />
      </svg>
    </div>
  );
}

/** Price whose digits roll like an odometer when the amount changes. */
export function RollingPrice({ amount }: { amount: number }) {
  const text = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  const chars = text.split('');
  return (
    <p className="rp" aria-label={`₹${text}`}>
      <span className="rp-cur" aria-hidden="true">₹</span>
      {chars.map((ch, idx) => {
        // Key from the right so units stay in the same column as the number grows
        const key = chars.length - idx;
        if (!/\d/.test(ch)) {
          return <span key={`s${key}`} className="rp-sep" aria-hidden="true">{ch}</span>;
        }
        return (
          <span key={`d${key}`} className="rp-digit" aria-hidden="true">
            <span className="rp-reel" style={{ transform: `translateY(-${Number(ch) * 10}%)` }}>
              {'0123456789'.split('').map((d) => <span key={d}>{d}</span>)}
            </span>
          </span>
        );
      })}
    </p>
  );
}

/** iOS-style segmented switch with a gliding thumb. */
export function QtySwitch({
  max,
  value,
  disabled,
  onChange,
}: {
  max: number;
  value: number;
  disabled?: boolean;
  onChange: (n: number) => void;
}) {
  const options = Array.from({ length: max }, (_, i) => i + 1);
  return (
    <div className="qs">
      <p className="qs-label" id="qs-label">How many?</p>
      <div
        className="qs-track"
        role="radiogroup"
        aria-labelledby="qs-label"
        style={{ gridTemplateColumns: `repeat(${max}, minmax(0, 1fr))` }}
      >
        <span
          className="qs-thumb"
          style={{ width: `calc((100% - 8px) / ${max})`, transform: `translateX(${(value - 1) * 100}%)` }}
          aria-hidden="true"
        />
        {options.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            disabled={disabled}
            onClick={() => {
              if (n !== value) haptic();
              onChange(n);
            }}
            className={`qs-opt ${value === n ? 'is-active' : ''}`}
          >
            <b>{n}</b> {n === 1 ? 'pad' : 'pads'}
          </button>
        ))}
      </div>
    </div>
  );
}

// Self-hosted copy first; the original URL is only a stopgap until the file is added.
const ASTRONAUT_LOCAL = '/brand/offline-astronaut.gif';
const ASTRONAUT_REMOTE = 'https://media.baamboozle.com/uploads/images/176438/e3a3bb40-aa26-400c-8f7c-a9ecedfa17f1.gif';

/** Offline mascot: animated astronaut GIF. */
export function OfflineAstronaut() {
  const [src, setSrc] = useState<string | null>(ASTRONAUT_LOCAL);
  if (!src) return null;
  return (
    <div className="oa" aria-hidden="true">
      <span className="oa-glow" />
      <span className="oa-floor" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="oa-img"
        onError={() => setSrc((cur) => (cur === ASTRONAUT_LOCAL ? ASTRONAUT_REMOTE : null))}
      />
    </div>
  );
}
