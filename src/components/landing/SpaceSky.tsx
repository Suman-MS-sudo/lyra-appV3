'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';

// Self-hosted: the CSP (next.config.ts) only allows media from our own origin.
const RIM_VIDEO = '/media/planet-rim.mp4';
const STAGE_W = 1672;
const STAGE_H = 941;

// The rim video only plays on desktop and when the visitor allows motion.
const VIDEO_MQ = '(min-width: 900px) and (orientation: landscape) and (prefers-reduced-motion: no-preference)';
const subscribeVideoMq = (cb: () => void) => {
  const mq = window.matchMedia(VIDEO_MQ);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};

export const isDesktopStage = () =>
  window.innerWidth >= 900 && window.matchMedia('(orientation: landscape)').matches;

/** Scale of the 1672×941 design frame for the current viewport. */
export const stageScale = () =>
  isDesktopStage() ? Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H) : window.innerWidth / STAGE_W;

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

/**
 * The home-page sky: starfield + glowing planet rim (looping video on desktop,
 * canvas drawing on phones / reduced motion). Fills its positioned parent.
 */
export function SpaceSky() {
  const rootRef = useRef<HTMLDivElement>(null);
  const starsRef = useRef<HTMLCanvasElement>(null);
  const rimRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Mounted client-side only, so phones never download the video
  const useVideo = useSyncExternalStore(subscribeVideoMq, () => window.matchMedia(VIDEO_MQ).matches, () => false);

  useEffect(() => {
    const layout = () => {
      rootRef.current?.style.setProperty('--zl-s', String(stageScale()));
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
    <div ref={rootRef} className="zl-sky" aria-hidden="true">
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
  );
}
