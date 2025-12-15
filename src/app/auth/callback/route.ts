import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const type = requestUrl.searchParams.get('type');
  const next = requestUrl.searchParams.get('next');
  
  // Use environment variable for base URL to avoid 0.0.0.0 issues
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || requestUrl.origin;

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.error('Error exchanging code:', error);
      return NextResponse.redirect(`${baseUrl}/login?error=auth_error&message=${encodeURIComponent(error.message)}`);
    }

    // Successfully exchanged code for session
    if (data.session) {
      // If there's a next parameter, redirect there
      if (next) {
        return NextResponse.redirect(`${baseUrl}${next}${type ? `?type=${type}` : ''}`);
      }
      
      // Otherwise redirect to reset password page
      return NextResponse.redirect(`${baseUrl}/reset-password${type ? `?type=${type}` : ''}`);
    }
  }

  // No code provided, redirect to login
  return NextResponse.redirect(`${baseUrl}/login${type ? `?type=${type}` : ''}`);
}
