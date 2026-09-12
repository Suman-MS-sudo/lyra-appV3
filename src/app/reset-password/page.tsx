'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function Spinner() {
  return (
    <div className="w-11 h-11 mx-auto mb-4 rounded-full flex items-center justify-center bg-[#1d1d1f]">
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
  const [sessionChecked, setSessionChecked] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Invalid or expired reset link. Please request a new password reset.');
      }
      setSessionChecked(true);
    };
    checkSession();
  }, [supabase.auth]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(updateError.message);
      } else {
        setSuccess(true);
        setTimeout(() => {
          const type = searchParams.get('type') || 'customer';
          router.push(`/login?type=${type}`);
        }, 2000);
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <Spinner />
          <p className="text-sm font-medium text-[#6e6e73]">Verifying reset link…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-white">
      <div className="max-w-md w-full">
        {/* Brand */}
        <div className="text-center mb-8 animate-float-up" style={{ animationDelay: '0.05s' }}>
          <span className="text-2xl font-semibold tracking-tight text-[#1d1d1f]">
            Lyra Enterprises
          </span>
          <p className="text-xs font-medium tracking-widest uppercase mt-1 text-[#86868b]">
            Smart Hygiene Access
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8 animate-card-enter border border-[#e5e5e7]"
          style={{ animationDelay: '0.10s' }}
        >
          {success ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 mx-auto mb-5 rounded-full flex items-center justify-center bg-[#e8f5ea]">
                <svg className="w-8 h-8 text-[#1d7a3c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-[#1d1d1f] mb-2">Password updated!</h2>
              <p className="text-[15px] text-[#6e6e73]">Redirecting to login…</p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-semibold tracking-tight text-[#1d1d1f] mb-1">Set new password</h2>
              <p className="text-[15px] mb-6 text-[#6e6e73]">Enter your new password below</p>

              {error && (
                <div className="mb-5 p-3.5 rounded-xl text-sm bg-[#fbe9e9] text-[#c8102e]">
                  <p className="mb-2">{error}</p>
                  <a href="/forgot-password" className="text-xs font-medium underline">
                    Request a new reset link →
                  </a>
                </div>
              )}

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label htmlFor="password" className="block text-xs font-semibold tracking-wide uppercase mb-2 text-[#6e6e73]">
                    New Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 min-h-11 rounded-xl text-[15px] outline-none transition-shadow border border-[#d2d2d7] focus:ring-2 focus:ring-[#0071e3] focus:border-transparent"
                    placeholder="At least 8 characters"
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-xs font-semibold tracking-wide uppercase mb-2 text-[#6e6e73]">
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 min-h-11 rounded-xl text-[15px] outline-none transition-shadow border border-[#d2d2d7] focus:ring-2 focus:ring-[#0071e3] focus:border-transparent"
                    placeholder="Repeat new password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 min-h-11 rounded-xl text-[15px] font-semibold text-white transition-transform active:scale-[0.97] disabled:cursor-not-allowed bg-[#1d1d1f] disabled:bg-[#f5f5f7] disabled:text-[#a1a1a6]"
                >
                  {loading ? 'Updating…' : 'Update Password'}
                </button>
              </form>
            </>
          )}
        </div>

        <div className="mt-6 text-center">
          <a href="/login" className="text-xs text-[#86868b] hover:text-[#1d1d1f] transition-colors">
            ← Back to Login
          </a>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <Spinner />
          <p className="text-sm font-medium text-[#6e6e73]">Loading…</p>
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
