'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const searchParams = useSearchParams();
  const initialType = searchParams.get('type') === 'admin' ? 'admin' : 'customer';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userType, setUserType] = useState<'admin' | 'customer'>(initialType);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createClient();

  // Handle password recovery tokens
  useEffect(() => {
    const handleRecovery = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');

      if (type === 'recovery' && accessToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: hashParams.get('refresh_token') || '',
        });
        if (!error) router.push('/reset-password');
      }
    };

    handleRecovery();
  }, [router, supabase.auth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      try {
        createClient();
      } catch (clientError) {
        throw new Error('Configuration error: Unable to initialize authentication. Please contact support.');
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          throw new Error('Invalid email or password. Please try again.');
        }
        if (signInError.message.includes('Email not confirmed')) {
          throw new Error('Please verify your email address before logging in.');
        }
        throw signInError;
      }

      if (!data?.user) throw new Error('Login failed: No user data returned');

      await new Promise(resolve => setTimeout(resolve, 500));

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError && profileError.code !== 'PGRST116') {
        throw new Error(`Unable to fetch user profile: ${profileError.message || 'Unknown error'}`);
      }

      if (!profile) {
        throw new Error('User profile not found. Your account may not be set up correctly. Please contact support.');
      }

      if (profile.role !== userType) {
        setError(`Invalid login type. You are registered as a ${profile.role}. Please select the correct login type above.`);
        await supabase.auth.signOut();
        setIsLoading(false);
        return;
      }

      if (profile.role === 'admin') {
        router.push('/admin/dashboard');
      } else {
        router.push('/customer/dashboard');
      }
    } catch (err: any) {
      if (err.message?.includes('fetch') || err.message?.includes('network')) {
        setError('Network error: Unable to connect to the server. Please check your internet connection and try again.');
      } else {
        setError(err.message || 'An unexpected error occurred during login. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative"
      style={{ background: 'linear-gradient(160deg, #eff6ff 0%, #ffffff 50%, #f8fafc 100%)' }}
    >
      {/* Glow blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
        <div className="absolute -top-40 -right-40 w-[480px] h-[480px] rounded-full animate-glow-drift-1" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.26) 0%, transparent 65%)' }} />
        <div className="absolute bottom-0 -left-32 w-80 h-80 rounded-full animate-glow-drift-2" style={{ background: 'radial-gradient(circle, rgba(96,165,250,0.20) 0%, transparent 65%)', animationDelay: '2s' }} />
        <div className="absolute top-1/2 right-1/4 w-64 h-64 rounded-full animate-glow-drift-3" style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.15) 0%, transparent 65%)', animationDelay: '4s' }} />
      </div>

      <div className="max-w-md w-full relative z-10">
        {/* Brand */}
        <div className="text-center mb-8 animate-float-up" style={{ animationDelay: '0.05s' }}>
          <Link href="/" className="inline-block">
            <span className="text-2xl font-black tracking-wide" style={{ color: '#0f172a' }}>
              Lyra <span style={{ color: '#2563EB' }}>Enterprises</span>
            </span>
          </Link>
          <p className="text-xs font-medium tracking-widest uppercase mt-1" style={{ color: '#64748b' }}>
            Smart Hygiene Access
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-3xl p-8 animate-card-enter"
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            boxShadow: '0 8px 48px rgba(15,23,42,0.08)',
            animationDelay: '0.10s',
          }}
        >
          <h2 className="text-2xl font-bold text-slate-900 mb-1">Welcome back</h2>
          <p className="text-sm mb-6" style={{ color: '#334155' }}>Sign in to your account</p>

          {/* User type toggle */}
          <div
            className="flex gap-2 p-1 rounded-2xl mb-6"
            style={{ background: '#f1f5f9', border: '1px solid #f1f5f9' }}
          >
            {(['customer', 'admin'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setUserType(type)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all capitalize"
                style={
                  userType === type
                    ? { background: 'linear-gradient(135deg, #2563EB, #3B82F6)', color: '#ffffff', boxShadow: '0 4px 14px rgba(37,99,235,0.40)' }
                    : { color: '#334155' }
                }
              >
                {type}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div
              className="mb-5 p-3.5 rounded-2xl text-sm"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.28)', color: '#B91C1C' }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold tracking-wide uppercase mb-2" style={{ color: '#334155' }}>
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500"
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  color: '#0f172a',
                }}
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold tracking-wide uppercase mb-2" style={{ color: '#334155' }}>
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500"
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  color: '#0f172a',
                }}
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0" />
                <span className="text-xs" style={{ color: '#334155' }}>Remember me</span>
              </label>
              <Link href="/forgot-password" className="text-xs font-medium transition-colors hover:text-slate-900" style={{ color: '#2563EB' }}>
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3.5 rounded-2xl text-sm font-semibold text-white transition-all active:scale-[0.97] ${!isLoading ? 'btn-glow' : ''}`}
              style={
                isLoading
                  ? { background: '#f8fafc', cursor: 'not-allowed', color: '#64748b' }
                  : { background: 'linear-gradient(135deg, #2563EB, #3B82F6)' }
              }
            >
              {isLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs" style={{ color: '#64748b' }}>
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="font-semibold transition-colors hover:text-slate-900" style={{ color: '#2563EB' }}>
                Sign up
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-xs transition-colors hover:text-slate-900" style={{ color: '#64748b' }}>
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(160deg, #eff6ff 0%, #ffffff 50%, #f8fafc 100%)' }}>
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center relative">
            <div className="absolute inset-0 rounded-full animate-ping" style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.35) 0%, transparent 70%)', animationDuration: '1.5s' }} />
            <div className="relative w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #2563EB, #3B82F6)' }}>
              <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          </div>
          <p className="text-sm font-medium" style={{ color: '#2563EB' }}>Loading…</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
