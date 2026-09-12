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
    <div className="min-h-screen flex items-center justify-center px-4 bg-white">
      <div className="max-w-md w-full">
        {/* Brand */}
        <div className="text-center mb-8 animate-float-up" style={{ animationDelay: '0.05s' }}>
          <Link href="/" className="inline-block">
            <span className="text-2xl font-semibold tracking-tight text-[#1d1d1f]">
              Lyra Enterprises
            </span>
          </Link>
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
              {/* Success icon */}
              <div className="w-16 h-16 mx-auto mb-5 rounded-full flex items-center justify-center bg-[#e8f5ea]">
                <svg className="w-8 h-8 text-[#1d7a3c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-[#1d1d1f] mb-2">Check your inbox</h2>
              <p className="text-[15px] mb-8 text-[#6e6e73]">
                A password reset link has been sent to <span className="font-medium text-[#1d1d1f]">{email}</span>.
                If it doesn&apos;t appear within a few minutes, check your spam folder.
              </p>
              <Link
                href="/login"
                className="block w-full py-3.5 min-h-11 rounded-xl text-[15px] font-semibold text-white text-center transition-transform active:scale-[0.97] bg-[#1d1d1f]"
              >
                Back to Login
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-semibold tracking-tight text-[#1d1d1f] mb-1">Reset password</h2>
              <p className="text-[15px] mb-6 text-[#6e6e73]">
                Enter your email and we&apos;ll send you a reset link
              </p>

              {error && (
                <div className="mb-5 p-3.5 rounded-xl text-sm bg-[#fbe9e9] text-[#c8102e]">
                  {error}
                </div>
              )}

              <form onSubmit={handleResetRequest} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-xs font-semibold tracking-wide uppercase mb-2 text-[#6e6e73]">
                    Email Address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 min-h-11 rounded-xl text-[15px] outline-none transition-shadow border border-[#d2d2d7] focus:ring-2 focus:ring-[#0071e3] focus:border-transparent"
                    placeholder="you@example.com"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 min-h-11 rounded-xl text-[15px] font-semibold text-white transition-transform active:scale-[0.97] disabled:cursor-not-allowed bg-[#1d1d1f] disabled:bg-[#f5f5f7] disabled:text-[#a1a1a6]"
                >
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>

                <div className="text-center pt-1">
                  <Link href="/login" className="text-xs font-medium text-[#0071e3] hover:underline">
                    ← Back to Login
                  </Link>
                </div>
              </form>
            </>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-xs text-[#86868b] hover:text-[#1d1d1f] transition-colors">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
