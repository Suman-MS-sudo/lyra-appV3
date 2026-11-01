import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';
import { billingDb, emailStatementToLyra } from '@/lib/billing';

/** Email a coin collection statement to Lyra's billing inbox (admin only). Body: { invoiceId } */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const { invoiceId } = await request.json().catch(() => ({}));
  if (!invoiceId) return NextResponse.json({ error: 'Invoice ID required' }, { status: 400 });

  const r = await emailStatementToLyra(billingDb(), invoiceId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ success: true, message: `Statement emailed to ${r.to}` });
}
