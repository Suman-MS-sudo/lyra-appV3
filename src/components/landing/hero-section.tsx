'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Bell, Building2, CreditCard, Droplet, LayoutDashboard, Menu, QrCode,
  Receipt, Search, Settings, Wallet, Wifi, X,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

// Self-hosted: the CSP (next.config.ts) only allows media from our own origin.
const RIM_VIDEO = '/media/planet-rim.mp4';
const PANEL_GLOW = '/media/panel-glow.png';

const STAGE_W = 1672;
const STAGE_H = 941;
const PANEL_TOP = 651;

const NAV = [
  { name: 'Home', href: '#top' },
  { name: 'How to pay', href: '#how-it-works' },
  { name: 'For institutions', href: '#features' },
  { name: 'About', href: '#about' },
  { name: 'Support', href: '#contact' },
];

// The rim video only plays on desktop and when the visitor allows motion.
const VIDEO_MQ = '(min-width: 900px) and (orientation: landscape) and (prefers-reduced-motion: no-preference)';
const subscribeVideoMq = (cb: () => void) => {
  const mq = window.matchMedia(VIDEO_MQ);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};

const isDesktop = () =>
  window.innerWidth >= 900 && window.matchMedia('(orientation: landscape)').matches;

/** Procedural white (blue-grey in light mode) dots — painted once per resize/theme. */
function paintStars(canvas: HTMLCanvasElement, dark: boolean) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const { width, height } = canvas.getBoundingClientRect();
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);
  // Seeded PRNG so the sky doesn't reshuffle on every resize
  let seed = 42;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const count = Math.round((width * height) / 2600);
  for (let i = 0; i < count; i++) {
    const r = rnd() < 0.92 ? rnd() * 0.9 + 0.25 : rnd() * 1.1 + 0.9;
    const a = rnd() * 0.7 + 0.15;
    ctx.fillStyle = dark ? `rgba(255,255,255,${a})` : `rgba(30,60,140,${a * 0.45})`;
    ctx.beginPath();
    ctx.arc(rnd() * width, rnd() * height, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Static fallback for the planet rim (phones, and until the video is ready). */
function paintRim(canvas: HTMLCanvasElement, dark: boolean) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const { width, height } = canvas.getBoundingClientRect();
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const cx = width / 2;
  const R = Math.max(width * 1.15, 900);
  const rimY = Math.min(height * 0.2, 170); // where the arc crests
  const cy = rimY - R;

  // Outer atmospheric glow
  const glow = ctx.createRadialGradient(cx, cy, R * 0.94, cx, cy, R * 1.22);
  glow.addColorStop(0, dark ? 'rgba(110,160,255,0.0)' : 'rgba(31,107,255,0)');
  glow.addColorStop(0.2, dark ? 'rgba(70,135,255,0.55)' : 'rgba(31,107,255,0.28)');
  glow.addColorStop(0.45, dark ? 'rgba(31,107,255,0.25)' : 'rgba(31,107,255,0.10)');
  glow.addColorStop(1, 'rgba(31,107,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // Planet body
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = dark ? '#000' : '#f5f7fb';
  ctx.fill();

  // Bright rim line
  ctx.save();
  ctx.shadowColor = dark ? 'rgba(130,180,255,0.95)' : 'rgba(31,107,255,0.6)';
  ctx.shadowBlur = 28;
  ctx.lineWidth = 2.2;
  const line = ctx.createLinearGradient(0, 0, width, 0);
  line.addColorStop(0, 'rgba(31,107,255,0)');
  line.addColorStop(0.25, dark ? '#4d8dff' : '#1f6bff');
  line.addColorStop(0.5, dark ? '#d6e6ff' : '#1a5cf0');
  line.addColorStop(0.75, dark ? '#4d8dff' : '#1f6bff');
  line.addColorStop(1, 'rgba(31,107,255,0)');
  ctx.strokeStyle = line;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function MiniChart() {
  // Sample week of vends — illustrative only
  const pts = [32, 41, 36, 52, 47, 61, 55, 68, 63, 74, 70, 82];
  const w = 520, h = 120, max = 90;
  const step = w / (pts.length - 1);
  const xy = pts.map((v, i) => [i * step, h - (v / max) * h] as const);
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[120px] mt-3" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="zl-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#1f6bff" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#1f6bff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill="url(#zl-area)" />
      <path d={line} fill="none" stroke="#3b82ff" strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function HeroSection() {
  const heroRef = useRef<HTMLElement>(null);
  const starsRef = useRef<HTMLCanvasElement>(null);
  const rimRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // Entrance runs from first paint via CSS (switched off there for reduced motion);
  // the video mounts client-side so phones never download it.
  const useVideo = useSyncExternalStore(subscribeVideoMq, () => window.matchMedia(VIDEO_MQ).matches, () => false);

  useEffect(() => {
    const layout = () => {
      const hero = heroRef.current;
      if (!hero) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (isDesktop()) {
        const s = Math.min(vw / STAGE_W, vh / STAGE_H);
        hero.style.setProperty('--zl-s', String(s));
        // Stretch the dashboard panel to the bottom edge of the viewport
        hero.style.setProperty('--zl-panel-h', `${Math.max(vh / s - PANEL_TOP, 200)}px`);
      } else {
        hero.style.setProperty('--zl-s', String(vw / STAGE_W));
        hero.style.removeProperty('--zl-panel-h');
      }
      const dark = document.documentElement.classList.contains('dark');
      if (starsRef.current) paintStars(starsRef.current, dark);
      if (rimRef.current) paintRim(rimRef.current, dark);
    };

    layout();
    window.addEventListener('resize', layout);
    window.addEventListener('lyra-theme-change', layout);
    return () => {
      window.removeEventListener('resize', layout);
      window.removeEventListener('lyra-theme-change', layout);
    };
  }, []);

  // Muted autoplay is sometimes refused on first try — keep nudging it.
  useEffect(() => {
    if (!useVideo) return;
    const tryPlay = () => {
      const v = videoRef.current;
      if (!v) return;
      if (v.readyState >= 3) v.classList.add('is-ready');
      if (!v.paused) return;
      v.muted = true;
      v.play().catch(() => {});
    };
    tryPlay();
    const id = setInterval(tryPlay, 1000);
    return () => clearInterval(id);
  }, [useVideo]);

  return (
    <section id="top" ref={heroRef} className="zl-hero zl-anim">
      <div className="zl-sky" aria-hidden="true">
        <canvas ref={starsRef} />
        {useVideo && (
          <video
            ref={videoRef}
            className="zl-rim-video"
            src={RIM_VIDEO}
            muted
            loop
            playsInline
            autoPlay
            preload="auto"
            onCanPlay={(e) => e.currentTarget.classList.add('is-ready')}
            onPlaying={(e) => e.currentTarget.classList.add('is-ready')}
          />
        )}
        <canvas ref={rimRef} className="zl-rim-canvas" style={{ height: '60%' }} />
      </div>

      <div className="zl-stage">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={PANEL_GLOW} alt="" aria-hidden="true" className="zl-panel-glow" />

        <nav className="zl-nav" aria-label="Global">
          <Link href="/" className="zl-logo">
            <span className="zl-logo-mark"><Droplet className="w-4 h-4 text-white" fill="white" /></span>
            Lyra Enterprises
          </Link>

          <div className="zl-menu">
            {NAV.map((item, i) => (
              <a key={item.name} href={item.href} className={i === 0 ? 'is-active' : ''}>{item.name}</a>
            ))}
          </div>

          <div className="zl-nav-right">
            <ThemeToggle />
            <Link href="/login" className="lyra-cta zl-nav-cta" style={{ minHeight: 40, padding: '9px 22px', fontSize: 14 }}>
              Login
            </Link>
            <button
              type="button"
              className="zl-burger"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </nav>

        {menuOpen && (
          <div className="zl-mobile-menu">
            {[...NAV, { name: 'Operator login', href: '/login' }].map((item) => (
              <a key={item.name} href={item.href} onClick={() => setMenuOpen(false)}>{item.name}</a>
            ))}
          </div>
        )}

        <div className="zl-copy">
          <span className="zl-badge"><span className="zl-badge-dot" />UPI payments for Lyra vending machines</span>
          <h1 className="zl-title">
            <span className="zl-line"><span><span className="zl-brand">Lyra</span> Scan. Pay by UPI.</span></span>
            <span className="zl-line"><span>Napkin dispensed.</span></span>
          </h1>
          <p className="zl-lede">
            The payment page for Lyra sanitary napkin vending machines. Scan the QR code on the
            machine&apos;s display, pay with any UPI app, and the machine dispenses in seconds — no app
            to install, no cash, no sign-up.
          </p>
          <div className="zl-ctas">
            <a href="#how-it-works" className="lyra-cta">
              <QrCode className="w-4 h-4" />
              How to pay
            </a>
            <Link href="/login" className="lyra-cta-ghost">
              Operator login
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <p className="zl-note">
            Want a machine for your institution?{' '}
            <a href="https://lyraenterprise.co.in/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[var(--fg)]">
              Buy or rent from ₹999/month at lyraenterprise.co.in
            </a>
          </p>
        </div>

        {/* Operator console preview — what institutions see after logging in (sample data) */}
        <div className="zl-panel" aria-label="Lyra operator dashboard preview">
          <div className="zl-panel-grid">
            <aside className="zl-side">
              <div className="zl-side-head">
                <span>Lyra Console</span>
                <Settings className="w-4 h-4 text-[var(--muted)]" />
              </div>
              <div className="zl-side-list">
                <span className="zl-side-item"><Search className="w-4 h-4" />Search</span>
                <span className="zl-side-item is-active"><LayoutDashboard className="w-4 h-4" />Dashboard</span>
                <span className="zl-side-item"><Building2 className="w-4 h-4" />Machines</span>
                <span className="zl-side-item"><Receipt className="w-4 h-4" />Transactions</span>
                <span className="zl-side-sep" />
                <span className="zl-side-item"><CreditCard className="w-4 h-4" />RFID Cards</span>
                <span className="zl-side-item"><Wallet className="w-4 h-4" />Billing</span>
                <span className="zl-side-item"><Settings className="w-4 h-4" />Settings</span>
              </div>
              <div className="zl-promo">
                <p className="text-sm font-semibold text-[var(--fg)]">Lyra Rentals</p>
                <p className="text-xs mt-1 text-[var(--muted)]">From ₹999/month — install, service and monitoring included.</p>
                <a href="https://lyraenterprise.co.in/" target="_blank" rel="noopener noreferrer" className="lyra-cta mt-3" style={{ minHeight: 32, padding: '6px 16px', fontSize: 12 }}>Enquire</a>
              </div>
            </aside>

            <div className="zl-main">
              <div className="zl-topbar">
                <span className="zl-chip">Operator console · sample data</span>
                <span className="flex items-center gap-3">
                  <Wifi className="w-4 h-4" />
                  <Bell className="w-4 h-4" />
                  <span className="text-[var(--fg)] font-medium">Campus Admin</span>
                  <span className="hidden sm:inline">LYRA-0042</span>
                </span>
              </div>

              <div className="zl-stats">
                <div className="zl-card">
                  <p className="zl-card-label">UPI payments verified (since install)</p>
                  <div className="zl-stat"><strong>214,402</strong><span className="zl-up">+12.5%</span></div>
                </div>
                <div className="zl-card">
                  <p className="zl-card-label">Active RFID cards / users</p>
                  <div className="zl-stat"><strong>6,412</strong><span className="zl-down">−3.1%</span></div>
                </div>
              </div>

              <div className="zl-lower">
                <div className="zl-card zl-chart">
                  <p className="text-sm font-semibold text-[var(--fg)]">Daily vends</p>
                  <MiniChart />
                </div>
                <div className="zl-card zl-cal">
                  <p className="text-sm font-semibold text-[var(--fg)]">This month</p>
                  <p className="zl-card-label mb-1">Start date – Now (monthly)</p>
                  <div className="zl-row"><span>Total vends</span><span><b>1,284</b> <span className="zl-up">+8.4%</span></span></div>
                  <div className="zl-row"><span>Avg. dispense time</span><b>4.2s</b></div>
                  <div className="zl-row"><span>Machines online</span><span><b>98.2%</b> <span className="zl-up">+2.1%</span></span></div>
                  <div className="zl-row"><span>Payments</span><b>UPI · Coin · RFID</b></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
