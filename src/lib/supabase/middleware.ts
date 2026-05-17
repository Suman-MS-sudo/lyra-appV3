import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // When the refresh token is invalid/expired, clear auth cookies so the
  // browser stops sending them on every subsequent request.
  if (error && (error as { code?: string }).code === 'refresh_token_not_found') {
    const cookieNames = request.cookies.getAll()
      .map((c) => c.name)
      .filter((name) => name.startsWith('sb-'));
    if (cookieNames.length > 0) {
      cookieNames.forEach((name) => supabaseResponse.cookies.delete(name));
    }
  }

  return { supabaseResponse, user };
}
