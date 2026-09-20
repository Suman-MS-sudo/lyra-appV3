import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const RECENT_LIMIT = 15;
const CHART_DAYS = 14;

/**
 * GET /api/machines/[id]/detail — everything the machine detail popup needs
 * in one request: machine info/health, recent transactions across all three
 * payment modes (coin, online/UPI, RFID), and a per-day transaction count +
 * revenue series for the last CHART_DAYS days.
 *
 * Open to both admins (any machine) and customers (only their own machines
 * -- direct owner, or any machine in their org if they're a super_customer).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: machineId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await service
    .from('profiles')
    .select('id, role, account_type, organization_id')
    .eq('id', user.id)
    .single();

  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: machine, error: machineError } = await service
    .from('vending_machines')
    .select('*')
    .eq('id', machineId)
    .single();

  if (machineError || !machine) {
    return NextResponse.json({ error: 'Machine not found' }, { status: 404 });
  }

  if (profile.role !== 'admin') {
    const isSuperCustomer = profile.account_type === 'super_customer';
    const owns = isSuperCustomer
      ? machine.customer_id === profile.organization_id
      : machine.customer_id === user.id;
    if (!owns) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  machine.asset_online = machine.last_ping
    ? (Date.now() - new Date(machine.last_ping).getTime()) < 10 * 60 * 1000
    : false;

  const chartStart = new Date();
  chartStart.setDate(chartStart.getDate() - (CHART_DAYS - 1));
  chartStart.setHours(0, 0, 0, 0);

  const [{ data: onlineTx }, { data: coinTx }, { data: rfidTx }] = await Promise.all([
    service
      .from('transactions')
      .select('id, total_amount, payment_status, created_at, products(name)')
      .eq('machine_id', machineId)
      .gte('created_at', chartStart.toISOString())
      .order('created_at', { ascending: false }),
    service
      .from('coin_payments')
      .select('id, amount_in_paisa, dispensed, created_at, products(name)')
      .eq('machine_id', machineId)
      .gte('created_at', chartStart.toISOString())
      .order('created_at', { ascending: false }),
    service
      .from('rfid_payments')
      .select('id, amount_in_paisa, dispensed, created_at, card_uid, products(name), rfid_cards(holder_name)')
      .eq('machine_id', machineId)
      .gte('created_at', chartStart.toISOString())
      .order('created_at', { ascending: false }),
  ]);

  type FeedItem = {
    id: string;
    type: 'upi' | 'coin' | 'rfid';
    amount: number;
    product_name: string | null;
    dispensed: boolean;
    created_at: string;
    holder_name?: string | null;
  };

  const feed: FeedItem[] = [
    ...(onlineTx || []).map((t: any) => ({
      id: t.id,
      type: 'upi' as const,
      amount: Number(t.total_amount) || 0,
      product_name: Array.isArray(t.products) ? t.products[0]?.name : t.products?.name,
      dispensed: t.payment_status === 'completed' || t.payment_status === 'success',
      created_at: t.created_at,
    })),
    ...(coinTx || []).map((t: any) => ({
      id: t.id,
      type: 'coin' as const,
      amount: (t.amount_in_paisa || 0) / 100,
      product_name: Array.isArray(t.products) ? t.products[0]?.name : t.products?.name,
      dispensed: !!t.dispensed,
      created_at: t.created_at,
    })),
    ...(rfidTx || []).map((t: any) => ({
      id: t.id,
      type: 'rfid' as const,
      amount: (t.amount_in_paisa || 0) / 100,
      product_name: Array.isArray(t.products) ? t.products[0]?.name : t.products?.name,
      dispensed: !!t.dispensed,
      created_at: t.created_at,
      holder_name: Array.isArray(t.rfid_cards) ? t.rfid_cards[0]?.holder_name : t.rfid_cards?.holder_name,
    })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));

  const recentTransactions = feed.slice(0, RECENT_LIMIT);

  // Per-day series for the chart, bucketed in the server's local calendar
  // day (matches how the rest of the admin/customer reporting already
  // buckets "today") -- CHART_DAYS entries, oldest first, zero-filled.
  const dayKey = (iso: string) => new Date(iso).toISOString().slice(0, 10);
  const buckets = new Map<string, { coin: number; upi: number; rfid: number; revenue: number }>();
  for (let i = 0; i < CHART_DAYS; i++) {
    const d = new Date(chartStart);
    d.setDate(d.getDate() + i);
    buckets.set(d.toISOString().slice(0, 10), { coin: 0, upi: 0, rfid: 0, revenue: 0 });
  }
  for (const item of feed) {
    const key = dayKey(item.created_at);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket[item.type] += 1;
    bucket.revenue += item.amount;
  }

  const chart = Array.from(buckets.entries()).map(([date, counts]) => ({ date, ...counts }));

  return NextResponse.json({
    machine,
    recentTransactions,
    chart,
    totals: {
      transactions: feed.length,
      revenue: feed.reduce((sum, t) => sum + t.amount, 0),
    },
  });
}
