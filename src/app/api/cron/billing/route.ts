import { NextRequest, NextResponse } from 'next/server';
import { runBillingCron } from '@/lib/billing';

// Long enough to invoice every organization and send their emails
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * Daily billing job (Vercel Cron, see vercel.json; or any scheduler hitting this URL).
 * Auth: `Authorization: Bearer $CRON_SECRET` (Vercel sends this automatically when CRON_SECRET is set).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await runBillingCron();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[cron/billing] failed:', error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Billing run failed' }, { status: 500 });
  }
}
