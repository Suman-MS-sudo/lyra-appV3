import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const PROTECTED = ['/admin', '/customer'];

function isProtected(pathname: string) {
  return PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Redirect while keeping any session cookies Supabase refreshed on this request. */
function redirectTo(request: NextRequest, from: NextResponse | null, pathname: string, params: Record<string, string> = {}) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = '';
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = NextResponse.redirect(url);
  from?.cookies.getAll().forEach((c) => res.cookies.set(c));
  return res;
}

export async function middleware(request: NextRequest) {
  try {
    return await handleMiddleware(request);
  } catch (error) {
    console.error('Middleware authentication failed:', error);
    // Fail closed: never serve a protected page when we couldn't verify the session
    if (isProtected(request.nextUrl.pathname)) {
      return redirectTo(request, null, '/login', { error: 'session_check_failed' });
    }
    return NextResponse.next();
  }
}

async function handleMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { supabaseResponse, supabase, user } = await updateSession(request);
  const onLogin = pathname === '/login';

  if (!isProtected(pathname) && !onLogin) return supabaseResponse;

  if (!user) {
    if (!isProtected(pathname)) return supabaseResponse;
    const hadSession = request.cookies.getAll().some((c) => c.name.startsWith('sb-'));
    return redirectTo(request, supabaseResponse, '/login', {
      redirectTo: pathname + request.nextUrl.search,
      ...(hadSession ? { error: 'session_expired' } : {}),
    });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, account_type')
    .eq('id', user.id)
    .maybeSingle();
  const home = profile?.role === 'admin' ? '/admin/dashboard' : '/customer/dashboard';

  // Signed in but no profile: an orphan auth account. Sign it out instead of showing empty pages.
  if (!profile) {
    if (onLogin) return supabaseResponse;
    const res = redirectTo(request, null, '/login', { error: 'no_account' });
    request.cookies.getAll().filter((c) => c.name.startsWith('sb-')).forEach((c) => res.cookies.delete(c.name));
    return res;
  }

  // Already signed in: skip the login form (unless the login page is showing an error)
  if (onLogin) {
    return request.nextUrl.searchParams.has('error') ? supabaseResponse : redirectTo(request, supabaseResponse, home);
  }

  if (pathname.startsWith('/admin') && profile.role !== 'admin') return redirectTo(request, supabaseResponse, '/customer/dashboard');
  if (pathname.startsWith('/customer') && profile.role === 'admin') return redirectTo(request, supabaseResponse, '/admin/dashboard');

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
