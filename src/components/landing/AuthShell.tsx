import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SpaceSky } from '@/components/landing/SpaceSky';

/**
 * Sign-in / password pages: the home-page sky (stars + planet rim) with the hero's
 * entrance choreography, and the form on a frosted glass card under a light strip.
 */
export function AuthShell({ badge, children, footer }: { badge: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="auth-space zl-anim">
      <SpaceSky />
      <ThemeToggle floating />

      <div className="auth-wrap">
        <div className="auth-brand">
          <span className="zl-badge"><span className="zl-badge-dot" />{badge}</span>
          <Link href="/" className="auth-title" aria-label="Lyra Enterprises home">
            <span className="zl-line"><span><span className="zl-brand">Lyra</span> Enterprises</span></span>
          </Link>
          <p className="auth-tag">Smart Hygiene Access</p>
        </div>

        <div className="auth-card-wrap">
          <span className="auth-glow" aria-hidden="true" />
          <div className="auth-card">{children}</div>
        </div>

        <div className="auth-foot">
          {footer ?? (
            <Link href="/" className="text-xs text-[var(--subtle)] hover:text-[var(--fg)] transition-colors">← Back to home</Link>
          )}
        </div>
      </div>
    </div>
  );
}
