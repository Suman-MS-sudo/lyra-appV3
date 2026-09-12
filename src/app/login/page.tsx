'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const searchParams = useSearchParams();
  const initialType = searchParams.get('type') === 'admin' ? 'admin' : 'customer';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-white">
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
          className="rounded-2xl p-8 bg-white animate-card-enter border border-[#e5e5e7]"
          style={{ animationDelay: '0.10s', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}
        >
          <h2 className="text-2xl font-semibold tracking-tight text-[#1d1d1f] mb-1">Welcome back</h2>
          <p className="text-[15px] mb-6 text-[#6e6e73]">Sign in to your account</p>

          {/* User type toggle */}
          <div className="flex gap-2 p-1 rounded-xl mb-6 bg-[#f5f5f7]" role="radiogroup" aria-label="Account type">
            {(['customer', 'admin'] as const).map((type) => (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={userType === type}
                onClick={() => setUserType(type)}
                className={`flex-1 py-2.5 min-h-11 rounded-lg text-sm font-semibold capitalize transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] ${
                  userType === type ? 'bg-[#1d1d1f] text-white' : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-xl text-sm flex items-start gap-2.5 bg-[#fbe9e9] text-[#c8102e]"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="block text-xs font-semibold tracking-wide uppercase mb-2 text-[#6e6e73]">
                Email address
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full px-4 py-3 min-h-11 rounded-xl text-[15px] outline-none transition-shadow border border-[#d2d2d7] focus:ring-2 focus:ring-[#0071e3] focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-xs font-semibold tracking-wide uppercase text-[#6e6e73]">
                  Password
                </label>
                <Link href="/forgot-password" className="text-xs font-medium text-[#0071e3] hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 pr-11 min-h-11 rounded-xl text-[15px] outline-none transition-shadow border border-[#d2d2d7] focus:ring-2 focus:ring-[#0071e3] focus:border-transparent"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex items-center justify-center w-11 min-h-11 text-[#86868b] hover:text-[#1d1d1f] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 min-h-11 rounded-xl text-[15px] font-semibold text-white transition-transform active:scale-[0.97] disabled:cursor-not-allowed bg-[#1d1d1f] disabled:bg-[#f5f5f7] disabled:text-[#a1a1a6]"
            >
              {isLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
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

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-11 h-11 mx-auto mb-4 rounded-full flex items-center justify-center bg-[#1d1d1f]">
            <svg className="w-5 h-5 text-white animate-spin motion-reduce:animate-none" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[#6e6e73]">Loading…</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
