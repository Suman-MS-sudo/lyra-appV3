import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';
import { billingDb, createInvoice, formatPaisa } from '@/lib/billing';
import { IST_OFFSET_MS } from '@/lib/time';

/** 'YYYY-MM-DD' → that day's 00:00 IST as a UTC instant. */
function istDayStart(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - IST_OFFSET_MS);
}

/**
 * Manual invoice for one organization and a custom date range (full IST days, end date inclusive).
 * Body: { organizationId, startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' }
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { organizationId, startDate, endDate } = await request.json().catch(() => ({}));
  if (!organizationId || !/^\d{4}-\d{2}-\d{2}$/.test(startDate || '') || !/^\d{4}-\d{2}-\d{2}$/.test(endDate || '')) {
    return NextResponse.json({ error: 'Choose an organization and a start and end date' }, { status: 400 });
  }
  const start = istDayStart(startDate);
  const end = new Date(istDayStart(endDate).getTime() + 86_400_000);
  if (end <= start) return NextResponse.json({ error: 'End date must be on or after the start date' }, { status: 400 });
  if (start.getTime() > Date.now()) return NextResponse.json({ error: 'The period cannot start in the future' }, { status: 400 });

  const db = billingDb();
  const r = await createInvoice(db, organizationId, start, end);
  if (r.status === 'failed') return NextResponse.json({ error: r.error }, { status: 500 });
  if (r.status === 'exists') {
    return NextResponse.json({ error: `Invoice ${r.invoice?.invoice_number ?? ''} already exists for this period`.replace('  ', ' ') }, { status: 409 });
  }
  return NextResponse.json({
    success: true,
    invoice: r.invoice,
    message: `Invoice ${r.invoice.invoice_number} created for ${formatPaisa(r.invoice.total_amount_paisa)} (${r.invoice.total_coin_transactions} coins)`,
  });
}
