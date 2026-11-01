import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/** Only same-site paths: blocks `//evil.com`, `/\evil.com` and `@evil.com` open redirects. */
function safePath(p: string | null): string | null {
  if (!p || !p.startsWith('/') || p.startsWith('//') || p.startsWith('/\\')) return null;
  return p;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const type = requestUrl.searchParams.get('type');
  const next = safePath(requestUrl.searchParams.get('next'));

  // Use environment variable for base URL to avoid 0.0.0.0 issues
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || requestUrl.origin).replace(/\/+$/, '');
  const withType = (path: string) => `${baseUrl}${path}${type ? `${path.includes('?') ? '&' : '?'}type=${encodeURIComponent(type)}` : ''}`;

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Error exchanging code:', error);
      return NextResponse.redirect(`${baseUrl}/login?error=link_expired`);
    }

    if (data.session) {
      return NextResponse.redirect(withType(next || '/reset-password'));
    }
  }

  return NextResponse.redirect(`${baseUrl}/login`);
}
