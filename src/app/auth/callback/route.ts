import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const type = requestUrl.searchParams.get('type') || 'customer';
  const next = requestUrl.searchParams.get('next') || '/reset-password';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.error('Error exchanging code:', error);
      return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_error`);
    }
  }

  // Redirect to password reset page
  return NextResponse.redirect(`${requestUrl.origin}${next}?type=${type}`);
}
