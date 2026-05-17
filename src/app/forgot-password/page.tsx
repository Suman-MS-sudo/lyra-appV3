'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/send-reset-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to send reset email');
      } else {
        setSuccess(true);
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative"
      style={{ background: 'linear-gradient(160deg, #2D1257 0%, #1E0A3C 50%, #150828 100%)' }}
    >
      {/* Glow blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
        <div className="absolute -top-40 -right-40 w-[480px] h-[480px] rounded-full animate-glow-drift-1" style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.26) 0%, transparent 65%)' }} />
        <div className="absolute bottom-0 -left-32 w-80 h-80 rounded-full animate-glow-drift-2" style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.20) 0%, transparent 65%)', animationDelay: '2s' }} />
      </div>

      <div className="max-w-md w-full relative z-10">
        {/* Brand */}
        <div className="text-center mb-8 animate-float-up" style={{ animationDelay: '0.05s' }}>
          <Link href="/" className="inline-block">
            <span className="text-2xl font-black tracking-wide" style={{ color: 'rgba(255,255,255,0.92)' }}>
              Lyra <span style={{ color: '#F472B6' }}>Enterprises</span>
            </span>
          </Link>
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
              {/* Success icon */}
              <div
                className="w-16 h-16 mx-auto mb-5 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(16,185,129,0.18)', border: '1px solid rgba(16,185,129,0.35)' }}
              >
                <svg className="w-8 h-8" style={{ color: '#34D399' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Check your inbox</h2>
              <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.50)' }}>
                A password reset link has been sent to <span className="font-medium" style={{ color: '#F472B6' }}>{email}</span>.
                If it doesn&apos;t appear within a few minutes, check your spam folder.
              </p>
              <Link
                href="/login"
                className="block w-full py-3.5 rounded-2xl text-sm font-semibold text-white text-center transition-all active:scale-[0.97] btn-glow"
                style={{ background: 'linear-gradient(135deg, #F43F5E, #EC4899)' }}
              >
                Back to Login
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-white mb-1">Reset password</h2>
              <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.42)' }}>
                Enter your email and we&apos;ll send you a reset link
              </p>

              {error && (
                <div
                  className="mb-5 p-3.5 rounded-2xl text-sm"
                  style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.28)', color: '#FCA5A5' }}
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleResetRequest} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-xs font-semibold tracking-wide uppercase mb-2" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    Email Address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all focus:ring-2 focus:ring-pink-500"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.14)',
                      color: '#f3f4f6',
                    }}
                    placeholder="you@example.com"
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
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>

                <div className="text-center pt-1">
                  <Link href="/login" className="text-xs font-medium transition-colors hover:text-white" style={{ color: '#F472B6' }}>
                    ← Back to Login
                  </Link>
                </div>
              </form>
            </>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-xs transition-colors hover:text-white" style={{ color: 'rgba(255,255,255,0.30)' }}>
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
