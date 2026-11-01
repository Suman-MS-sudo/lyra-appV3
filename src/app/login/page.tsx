'use client';

import { ThemeToggle } from '@/components/ThemeToggle';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

/** Messages for `?error=` / status flags set by middleware, logout, callback and reset pages. */
const NOTICES: Record<string, { tone: 'error' | 'info' | 'success'; text: string }> = {
  session_expired: { tone: 'info', text: 'Your session expired. Please sign in again.' },
  session_check_failed: { tone: 'error', text: "We couldn't verify your session. Please sign in again." },
  no_account: { tone: 'error', text: 'This login has no Lyra account attached. Contact your administrator.' },
  link_expired: { tone: 'error', text: 'That link has expired or was already used. Request a new one from "Forgot password".' },
  signedout: { tone: 'success', text: "You've been signed out." },
  reset: { tone: 'success', text: 'Password updated. Sign in with your new password.' },
};

/** Only follow same-site redirects into the area this role can open. */
function destination(redirectTo: string | null, role: string) {
  const home = role === 'admin' ? '/admin/dashboard' : '/customer/dashboard';
  if (!redirectTo || !redirectTo.startsWith('/') || redirectTo.startsWith('//') || redirectTo.startsWith('/\\')) return home;
  const area = role === 'admin' ? '/admin' : '/customer';
  return redirectTo === area || redirectTo.startsWith(`${area}/`) || redirectTo.startsWith(`${area}?`) ? redirectTo : home;
}

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const noticeKey = searchParams.get('error') || (searchParams.has('signedout') ? 'signedout' : searchParams.has('reset') ? 'reset' : '');
  const notice = !error ? NOTICES[noticeKey] : undefined;

  // Older Supabase-hosted recovery links land here with tokens in the URL hash
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    if (hashParams.get('type') === 'recovery' && accessToken) {
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: hashParams.get('refresh_token') || '' })
        .then(({ error }) => { if (!error) router.replace('/reset-password'); });
    }
  }, [router, supabase.auth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError('Enter your email and password.');
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });

      if (signInError) {
        const msg = signInError.message.toLowerCase();
        if (msg.includes('invalid login credentials')) throw new Error('Incorrect email or password.');
        if (msg.includes('email not confirmed')) throw new Error('Please confirm your email address before signing in.');
        if (msg.includes('rate limit') || signInError.status === 429) throw new Error('Too many attempts. Wait a minute and try again.');
        throw signInError;
      }
      if (!data?.user) throw new Error('Sign-in failed. Please try again.');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError || !profile) {
        await supabase.auth.signOut({ scope: 'local' });
        throw new Error(profileError
          ? "We couldn't load your account. Please try again."
          : NOTICES.no_account.text);
      }

      router.replace(destination(searchParams.get('redirectTo'), profile.role));
      router.refresh();
      // Keep the button in its loading state while the dashboard loads
      return;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      setError(/fetch|network/i.test(message)
        ? "Can't reach the server. Check your internet connection and try again."
        : message || 'Something went wrong. Please try again.');
    }
    setIsLoading(false);
  };

  const onPasswordKey = (e: React.KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState?.('CapsLock') ?? false);
  const forgotHref = email.trim() ? `/forgot-password?email=${encodeURIComponent(email.trim())}` : '/forgot-password';

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[var(--surface)]">
      <ThemeToggle floating />
      <div className="max-w-md w-full">
        {/* Brand */}
        <div className="text-center mb-8 animate-float-up" style={{ animationDelay: '0.05s' }}>
          <Link href="/" className="inline-block">
            <span className="text-2xl font-semibold tracking-tight text-[var(--fg)]">
              Lyra Enterprises
            </span>
          </Link>
          <p className="text-xs font-medium tracking-widest uppercase mt-1 text-[var(--subtle)]">
            Smart Hygiene Access
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8 bg-[var(--surface)] animate-card-enter border border-[var(--line)]"
          style={{ animationDelay: '0.10s', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}
        >
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--fg)] mb-1">Welcome back</h2>
          <p className="text-[15px] mb-6 text-[var(--muted)]">Sign in to manage your machines</p>

          {(error || notice) && (
            <div
              role={error || notice?.tone === 'error' ? 'alert' : 'status'}
              className={`mb-5 p-3.5 rounded-xl text-sm flex items-start gap-2.5 ${
                error || notice?.tone === 'error'
                  ? 'bg-[var(--danger-bg)] text-[var(--danger)]'
                  : notice?.tone === 'success'
                    ? 'bg-[var(--success-bg)] text-[var(--success)]'
                    : 'bg-[var(--surface-2)] text-[var(--fg-2)]'
              }`}
            >
              {error || notice?.tone === 'error' ? <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                : notice?.tone === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  : <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />}
              <span>{error || notice?.text}</span>
            </div>
          )}

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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus={!email}
                className="w-full px-4 py-3 min-h-11 rounded-xl text-[15px] outline-none transition-shadow border border-[var(--line-strong)] focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-xs font-semibold tracking-wide uppercase text-[var(--muted)]">
                  Password
                </label>
                <Link href={forgotHref} className="text-xs font-medium text-[var(--accent-ink)] hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyUp={onPasswordKey}
                  onKeyDown={onPasswordKey}
                  onBlur={() => setCapsLock(false)}
                  required
                  autoFocus={!!email}
                  aria-describedby={capsLock ? 'caps-hint' : undefined}
                  className="w-full px-4 py-3 pr-11 min-h-11 rounded-xl text-[15px] outline-none transition-shadow border border-[var(--line-strong)] focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex items-center justify-center w-11 min-h-11 text-[var(--subtle)] hover:text-[var(--fg)] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {capsLock && <p id="caps-hint" className="mt-1.5 text-xs font-medium text-[var(--warning)]">Caps Lock is on</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              aria-busy={isLoading}
              className="w-full py-3.5 min-h-11 lyra-chamfer text-[15px] font-semibold text-white transition-transform active:scale-[0.97] disabled:cursor-not-allowed bg-[var(--accent)] disabled:bg-[var(--surface-2)] disabled:text-[var(--subtle)]"
            >
              {isLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-xs text-[var(--subtle)] hover:text-[var(--fg)] transition-colors">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[var(--surface)]">
        <div className="text-center">
          <div className="w-11 h-11 mx-auto mb-4 rounded-full flex items-center justify-center bg-[var(--accent)]">
            <svg className="w-5 h-5 text-white animate-spin motion-reduce:animate-none" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[var(--muted)]">Loading…</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
