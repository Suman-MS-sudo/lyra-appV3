'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

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

  const darkBg: React.CSSProperties = { background: 'linear-gradient(160deg, #2D1257 0%, #1E0A3C 50%, #150828 100%)' };

  if (!sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={darkBg}>
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center relative">
            <div className="absolute inset-0 rounded-full animate-ping" style={{ background: 'radial-gradient(circle, rgba(244,63,94,0.35) 0%, transparent 70%)', animationDuration: '1.5s' }} />
            <div className="relative w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #F43F5E, #EC4899)' }}>
              <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          </div>
          <p className="text-sm font-medium" style={{ color: '#F472B6' }}>Verifying reset link…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative" style={darkBg}>
      {/* Glow blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
        <div className="absolute -top-40 -right-40 w-[480px] h-[480px] rounded-full animate-glow-drift-1" style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.26) 0%, transparent 65%)' }} />
        <div className="absolute bottom-0 -left-32 w-80 h-80 rounded-full animate-glow-drift-2" style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.20) 0%, transparent 65%)', animationDelay: '2s' }} />
      </div>

      <div className="max-w-md w-full relative z-10">
        {/* Brand */}
        <div className="text-center mb-8 animate-float-up" style={{ animationDelay: '0.05s' }}>
          <span className="text-2xl font-black tracking-wide" style={{ color: 'rgba(255,255,255,0.92)' }}>
            Lyra <span style={{ color: '#F472B6' }}>Enterprises</span>
          </span>
          <p className="text-xs font-medium tracking-widest uppercase mt-1" style={{ color: 'rgba(255,255,255,0.30)' }}>
            Smart Hygiene Access
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-3xl p-8 animate-card-enter"
          style={{
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.13)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            boxShadow: '0 8px 48px rgba(0,0,0,0.40)',
            animationDelay: '0.10s',
          }}
        >
          {success ? (
            <div className="text-center py-4">
              <div
                className="w-16 h-16 mx-auto mb-5 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(16,185,129,0.18)', border: '1px solid rgba(16,185,129,0.35)' }}
              >
                <svg className="w-8 h-8" style={{ color: '#34D399' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Password updated!</h2>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.50)' }}>Redirecting to login…</p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-white mb-1">Set new password</h2>
              <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.42)' }}>Enter your new password below</p>

              {error && (
                <div
                  className="mb-5 p-3.5 rounded-2xl text-sm"
                  style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.28)', color: '#FCA5A5' }}
                >
                  <p className="mb-2">{error}</p>
                  <a
                    href="/forgot-password"
                    className="text-xs font-medium underline"
                    style={{ color: '#F472B6' }}
                  >
                    Request a new reset link →
                  </a>
                </div>
              )}

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label htmlFor="password" className="block text-xs font-semibold tracking-wide uppercase mb-2" style={{ color: 'rgba(255,255,255,0.45)' }}>
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
                    className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all focus:ring-2 focus:ring-pink-500"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.14)',
                      color: '#f3f4f6',
                    }}
                    placeholder="At least 8 characters"
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-xs font-semibold tracking-wide uppercase mb-2" style={{ color: 'rgba(255,255,255,0.45)' }}>
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
                    className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all focus:ring-2 focus:ring-pink-500"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.14)',
                      color: '#f3f4f6',
                    }}
                    placeholder="Repeat new password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-3.5 rounded-2xl text-sm font-semibold text-white transition-all active:scale-[0.97] ${!loading ? 'btn-glow' : ''}`}
                  style={
                    loading
                      ? { background: 'rgba(255,255,255,0.08)', cursor: 'not-allowed', color: 'rgba(255,255,255,0.35)' }
                      : { background: 'linear-gradient(135deg, #F43F5E, #EC4899)' }
                  }
                >
                  {loading ? 'Updating…' : 'Update Password'}
                </button>
              </form>
            </>
          )}
        </div>

        <div className="mt-6 text-center">
          <a href="/login" className="text-xs transition-colors hover:text-white" style={{ color: 'rgba(255,255,255,0.30)' }}>
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(160deg, #2D1257 0%, #1E0A3C 50%, #150828 100%)' }}>
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center relative">
            <div className="absolute inset-0 rounded-full animate-ping" style={{ background: 'radial-gradient(circle, rgba(244,63,94,0.35) 0%, transparent 70%)', animationDuration: '1.5s' }} />
            <div className="relative w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #F43F5E, #EC4899)' }}>
              <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          </div>
          <p className="text-sm font-medium" style={{ color: '#F472B6' }}>Loading…</p>
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
