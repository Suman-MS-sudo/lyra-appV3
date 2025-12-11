import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);

  // Protected routes
  const protectedRoutes = ['/admin', '/customer'];
  const isProtectedRoute = protectedRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  if (isProtectedRoute && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Role-based route protection
  if (user && isProtectedRoute) {
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('role, account_type')
      .eq('id', user.id)
      .single();

    const isAdminRoute = request.nextUrl.pathname.startsWith('/admin');
    const isCustomerRoute = request.nextUrl.pathname.startsWith('/customer');
    const isSuperCustomer = profile?.account_type === 'super_customer';

    // Redirect regular customers (not super_customers) trying to access admin routes
    if (isAdminRoute && profile?.role === 'customer' && !isSuperCustomer) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/customer/dashboard';
      return NextResponse.redirect(redirectUrl);
    }

    // Redirect admins trying to access customer routes
    if (isCustomerRoute && profile?.role === 'admin') {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/admin/dashboard';
      return NextResponse.redirect(redirectUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
