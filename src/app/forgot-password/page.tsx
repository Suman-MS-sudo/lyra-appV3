'use client';

import { AuthShell } from '@/components/landing/AuthShell';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertCircle } from 'lucide-react';

const RESEND_AFTER = 60;

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = async (address: string) => {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch('/api/auth/send-reset-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: address }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error || "We couldn't send the email. Please try again.");
        if (response.status === 429) setCooldown(RESEND_AFTER);
        return;
      }
      setSentTo(address);
      setCooldown(RESEND_AFTER);
    } catch {
      setError("Can't reach the server. Check your internet connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const address = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError('Enter a valid email address.');
      return;
    }
    send(address);
  };

  const ErrorBox = error ? (
    <div role="alert" className="mb-5 p-3.5 rounded-xl text-sm flex items-start gap-2.5 bg-[var(--danger-bg)] text-[var(--danger)]">
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
      <span>{error}</span>
    </div>
  ) : null;

  return (
    <AuthShell badge="Account recovery">
          {sentTo ? (
            <div className="text-center py-2" role="status">
              <div className="w-16 h-16 mx-auto mb-5 rounded-full flex items-center justify-center bg-[var(--success-bg)]">
                <svg className="w-8 h-8 text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-[var(--fg)] mb-2">Check your inbox</h2>
              <p className="text-[15px] mb-2 text-[var(--muted)]">
                If <span className="font-medium text-[var(--fg)] break-all">{sentTo}</span> belongs to a Lyra account,
                a reset link is on its way. It expires in 1 hour.
              </p>
              <p className="text-sm mb-6 text-[var(--subtle)]">Nothing after a few minutes? Check spam, or make sure you used the email your account was created with.</p>
              {ErrorBox}
              <Link
                href={`/login?email=${encodeURIComponent(sentTo)}`}
                className="block w-full py-3.5 min-h-11 lyra-chamfer text-[15px] font-semibold text-white text-center transition-transform active:scale-[0.97] bg-[var(--accent)]"
              >
                Back to sign in
              </Link>
              <button
                type="button"
                onClick={() => send(sentTo)}
                disabled={cooldown > 0 || loading}
                className="mt-4 text-sm font-medium text-[var(--accent-ink)] hover:underline disabled:no-underline disabled:text-[var(--subtle)] disabled:cursor-not-allowed"
              >
                {loading ? 'Sending…' : cooldown > 0 ? `Resend email in ${cooldown}s` : 'Resend email'}
              </button>
              <div className="mt-2">
                <button type="button" onClick={() => { setSentTo(null); setError(null); }} className="text-xs text-[var(--subtle)] hover:text-[var(--fg)]">
                  Use a different email
                </button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-semibold tracking-tight text-[var(--fg)] mb-1">Forgot your password?</h2>
              <p className="text-[15px] mb-6 text-[var(--muted)]">
                Enter your account email and we&apos;ll send you a link to choose a new one.
              </p>

              {ErrorBox}

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div>
                  <label htmlFor="email" className="block text-xs font-semibold tracking-wide uppercase mb-2 text-[var(--muted)]">
                    Email address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    autoFocus
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 min-h-11 rounded-xl text-[15px] outline-none transition-shadow border border-[var(--line-strong)] focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                    placeholder="you@company.com"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || cooldown > 0}
                  aria-busy={loading}
                  className="w-full py-3.5 min-h-11 lyra-chamfer text-[15px] font-semibold text-white transition-transform active:scale-[0.97] disabled:cursor-not-allowed bg-[var(--accent)] disabled:bg-[var(--surface-2)] disabled:text-[var(--subtle)]"
                >
                  {loading ? 'Sending…' : cooldown > 0 ? `Try again in ${cooldown}s` : 'Send reset link'}
                </button>

                <div className="text-center pt-1">
                  <Link href={email.trim() ? `/login?email=${encodeURIComponent(email.trim())}` : '/login'} className="text-xs font-medium text-[var(--accent-ink)] hover:underline">
                    ← Back to sign in
                  </Link>
                </div>
              </form>
            </>
          )}
    </AuthShell>
  );
}

export default function ForgotPasswordPage() {
  // useSearchParams needs a Suspense boundary
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--surface)]" />}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
