'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

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
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      });

      if (resetError) {
        setError(resetError.message);
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <Link href="/">
            <h2 className="text-center text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent cursor-pointer">
              Lyra Enterprises
            </h2>
          </Link>
          <h3 className="mt-6 text-center text-2xl font-bold text-gray-900">
            Reset Your Password
          </h3>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your email address and we'll send you a reset link
          </p>
        </div>

        {success ? (
          <div className="rounded-xl bg-white px-8 py-10 shadow-lg">
            <div className="rounded-lg bg-green-50 p-4 mb-4">
              <p className="text-center text-green-800 font-medium">
                ✅ Password reset email sent!
              </p>
            </div>
            <p className="text-sm text-gray-600 text-center mb-6">
              Check your email for a link to reset your password. If it doesn't appear within a few minutes, check your spam folder.
            </p>
            <Link
              href="/login"
              className="block w-full rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm hover:from-blue-700 hover:to-purple-700 transition-all"
            >
              Back to Login
            </Link>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleResetRequest}>
            <div className="space-y-4 rounded-xl bg-white px-8 py-10 shadow-lg">
              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Enter your email"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>

              <div className="text-center">
                <Link
                  href="/login"
                  className="text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
                >
                  ← Back to Login
                </Link>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
