import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST() {
  const supabase = await createClient();
  // 'local' signs out this browser only; other devices stay signed in
  await supabase.auth.signOut({ scope: 'local' });

  // 303 so the browser follows with a GET (a 307 would re-POST to /login).
  // Relative Location keeps the user on whatever host they're using.
  return new NextResponse(null, {
    status: 303,
    headers: { Location: '/login?signedout=1', 'Cache-Control': 'no-store' },
  });
}
