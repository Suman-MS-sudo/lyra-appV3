import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const type = requestUrl.searchParams.get('type');
  const next = requestUrl.searchParams.get('next');

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.error('Error exchanging code:', error);
      return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_error&message=${encodeURIComponent(error.message)}`);
    }

    // Successfully exchanged code for session
    if (data.session) {
      // If there's a next parameter, redirect there
      if (next) {
        return NextResponse.redirect(`${requestUrl.origin}${next}${type ? `?type=${type}` : ''}`);
      }
      
      // Otherwise redirect to reset password page
      return NextResponse.redirect(`${requestUrl.origin}/reset-password${type ? `?type=${type}` : ''}`);
    }
  }

  // No code provided, redirect to login
  return NextResponse.redirect(`${requestUrl.origin}/login${type ? `?type=${type}` : ''}`);
}
