import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendPasswordChangedEmail } from '@/lib/account-mail';

const sent = new Map<string, number>();

/** Called by the reset page right after a successful password change, while the session is live. */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  // One notice per account per minute is plenty
  const last = sent.get(user.id) || 0;
  if (Date.now() - last > 60_000) {
    sent.set(user.id, Date.now());
    await sendPasswordChangedEmail(user.email);
  }
  return NextResponse.json({ success: true });
}
