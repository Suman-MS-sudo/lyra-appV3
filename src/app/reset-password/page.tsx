'use client';

import { AuthShell } from '@/components/landing/AuthShell';
import { PasswordInput } from '@/components/PasswordInput';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function Spinner() {
  return (
    <div className="w-11 h-11 mx-auto mb-4 rounded-full flex items-center justify-center bg-[var(--accent)]">
      <svg className="w-5 h-5 text-white animate-spin motion-reduce:animate-none" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    </div>
  );
}

function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  // Links we email carry the recovery token hash and point straight at this
  // page. It's only redeemed on submit, so mail scanners that pre-open links
  // can't use it up. Older links arrive via /auth/callback with a session instead.
  const tokenHash = searchParams.get('token_hash');
  // Welcome emails for new accounts carry intent=invite
  const isInvite = searchParams.get('intent') === 'invite';
  const checks = [
    { ok: password.length >= 8, label: 'At least 8 characters' },
    { ok: /[A-Za-z]/.test(password) && /[0-9]/.test(password), label: 'Letters and numbers' },
    { ok: password.length > 0 && password === confirmPassword, label: 'Passwords match' },
  ];
  const [sessionChecked, setSessionChecked] = useState(!!tokenHash);

  useEffect(() => {
    if (tokenHash) return;
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('This link is invalid or has expired. Request a new one below.');
      }
      setSessionChecked(true);
    };
    checkSession();
  }, [supabase.auth, tokenHash]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Use a mix of letters and numbers.');
      return;
    }
    if (password !== confirmPassword) {
      setError("The two passwords don't match.");
      return;
    }

    setLoading(true);

    try {
      if (tokenHash) {
        const { error: verifyError } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash });
        if (verifyError) {
          setError('This reset link is invalid, expired or already used. Please request a new password reset.');
          return;
        }
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(/different from the old/i.test(updateError.message)
          ? 'Choose a password different from your current one.'
          : updateError.message);
      } else {
        // Security notice to the account's inbox (while the session is still valid)
        await fetch('/api/auth/password-changed', { method: 'POST' }).catch(() => {});
        // Recovery session was only for this change: sign in fresh with the new password
        await supabase.auth.signOut({ scope: 'local' });
        setSuccess(true);
        setTimeout(() => router.replace('/login?reset=1'), 1800);
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--surface)]">
        <div className="text-center">
          <Spinner />
          <p className="text-sm font-medium text-[var(--muted)]">Verifying reset link…</p>
        </div>
      </div>
    );
  }

  return (
    <AuthShell badge="Account security"
      footer={<a href="/login" className="text-xs text-[var(--subtle)] hover:text-[var(--fg)] transition-colors">← Back to sign in</a>}>
          {success ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 mx-auto mb-5 rounded-full flex items-center justify-center bg-[var(--success-bg)]">
                <svg className="w-8 h-8 text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-[var(--fg)] mb-2">{isInvite ? 'Password set' : 'Password updated'}</h2>
              <p className="text-[15px] text-[var(--muted)]">Taking you to sign in…</p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-semibold tracking-tight text-[var(--fg)] mb-1">{isInvite ? 'Set your password' : 'Choose a new password'}</h2>
              <p className="text-[15px] mb-6 text-[var(--muted)]">{isInvite ? 'Welcome to Lyra! Create a password to finish setting up your account.' : "Pick a password you haven't used here before."}</p>

              {error && (
                <div role="alert" className="mb-5 p-3.5 rounded-xl text-sm bg-[var(--danger-bg)] text-[var(--danger)]">
                  <p className="mb-2">{error}</p>
                  {/(link|expired)/i.test(error) && (
                    <a href="/forgot-password" className="text-xs font-medium underline">
                      Request a new link →
                    </a>
                  )}
                </div>
              )}

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label htmlFor="password" className="block text-xs font-semibold tracking-wide uppercase mb-2 text-[var(--muted)]">
                    New Password
                  </label>
                  <PasswordInput
                    id="password"
                    name="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 min-h-11 rounded-xl text-[15px] outline-none transition-shadow border border-[var(--line-strong)] focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                    placeholder="At least 8 characters"
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-xs font-semibold tracking-wide uppercase mb-2 text-[var(--muted)]">
                    Confirm Password
                  </label>
                  <PasswordInput
                    id="confirmPassword"
                    name="confirmPassword"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 min-h-11 rounded-xl text-[15px] outline-none transition-shadow border border-[var(--line-strong)] focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                    placeholder="Repeat new password"
                  />
                </div>

                <ul className="grid gap-1.5 text-xs" aria-label="Password requirements">
                  {checks.map((c) => (
                    <li key={c.label} className={`flex items-center gap-2 ${c.ok ? 'text-[var(--success)]' : 'text-[var(--subtle)]'}`}>
                      <span aria-hidden="true" className={`inline-flex w-4 h-4 items-center justify-center rounded-full text-[10px] font-bold ${c.ok ? 'bg-[var(--success-bg)]' : 'bg-[var(--surface-2)]'}`}>{c.ok ? '✓' : ''}</span>
                      {c.label}
                    </li>
                  ))}
                </ul>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 min-h-11 lyra-chamfer text-[15px] font-semibold text-white transition-transform active:scale-[0.97] disabled:cursor-not-allowed bg-[var(--accent)] disabled:bg-[var(--surface-2)] disabled:text-[var(--subtle)]"
                >
                  {loading ? 'Saving…' : isInvite ? 'Set password' : 'Update password'}
                </button>
              </form>
            </>
          )}
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[var(--surface)]">
        <div className="text-center">
          <Spinner />
          <p className="text-sm font-medium text-[var(--muted)]">Loading…</p>
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
