import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendPasswordResetEmail } from '@/lib/account-mail';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Best-effort in-memory throttling (per server instance): stops inbox flooding and SMTP abuse.
const hits = new Map<string, number[]>();
function tooMany(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (recent.length >= max) { hits.set(key, recent); return true; }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (tooMany(`ip:${ip}`, 10, 15 * 60_000) || tooMany(`email:${email}`, 5, 60 * 60_000)) {
      return NextResponse.json({ error: 'Too many reset requests. Please wait a few minutes and try again.' }, { status: 429 });
    }
    if (tooMany(`email-burst:${email}`, 1, 60_000)) {
      return NextResponse.json({ error: 'A reset email was just sent. Please wait a minute before asking for another.' }, { status: 429 });
    }

    // Only real app users get a link. An auth account without a profile row is an orphan
    // (half-finished signup or deleted user) and must not receive reset emails.
    const admin = createAdminClient();
    const { data: profile } = await admin.from('profiles').select('id').eq('email', email).maybeSingle();
    if (!profile) {
      // Same response as success to avoid revealing which emails have accounts
      return NextResponse.json({ success: true });
    }

    const result = await sendPasswordResetEmail(admin, email);
    if (!result.ok) {
      console.error('[send-reset-email] failed:', result.error);
      return NextResponse.json({ error: "We couldn't send the email right now. Please try again in a moment." }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[send-reset-email] Unexpected error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
