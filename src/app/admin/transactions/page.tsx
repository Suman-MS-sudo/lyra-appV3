import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { AlertTriangle, Building2, CreditCard, IndianRupee, MapPin, Package, Receipt, ShoppingBag } from 'lucide-react';
import { AreaChart, BarList, Donut, PageHeader, Panel, Radar, StatGrid, StatTile, TopCard, dailySeries, inr } from '@/components/ui/kit';
import TransactionsExplorer, { type TxRow, type TxStatus } from '@/components/TransactionsExplorer';

export const revalidate = 0;

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];
const DAY = 86_400_000;
// Safety cap per payment type for the selected window (+ the previous window used for comparisons)
const ROW_CAP = 10_000;

/** Current + previous window boundaries (module-level so the component body stays pure). */
function windows(days: Range) {
  const now = Date.now();
  return { now, start: now - days * DAY, prevStart: now - 2 * days * DAY };
}

function pctChange(cur: number, prev: number) {
  if (prev <= 0) return cur > 0 ? '▲ new' : 'no change';
  const p = Math.round(((cur - prev) / prev) * 100);
  return `${p >= 0 ? '▲' : '▼'} ${Math.abs(p)}% vs previous period`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function TransactionsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('role, account_type')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') redirect('/customer/dashboard');

  const params = await searchParams;
  const range: Range = (RANGES as readonly number[]).includes(Number(params.range)) ? (Number(params.range) as Range) : 30;
  const { start, prevStart } = windows(range);
  const since = new Date(prevStart).toISOString();

  // Super customers only ever see their own machines (and nothing if they have none).
  const isSuperCustomer = profile?.account_type === 'super_customer';
  let machineIds: string[] | null = null;
  if (isSuperCustomer) {
    const { data: machines } = await serviceSupabase.from('vending_machines').select('id').eq('customer_id', user.id);
    machineIds = machines?.map((m: { id: string }) => m.id) || [];
  }
  const scope = <T,>(q: T): T => (machineIds ? (q as any).in('machine_id', machineIds) : q);
  const none = machineIds !== null && machineIds.length === 0;

  const [{ data: online }, { data: coin }, { data: rfid }] = none
    ? [{ data: [] }, { data: [] }, { data: [] }]
    : await Promise.all([
        scope(
          serviceSupabase
            .from('transactions')
            .select('id, created_at, total_amount, payment_status, dispensed, items, razorpay_payment_id, profiles!transactions_customer_id_fkey(email), vending_machines!transactions_machine_id_fkey(name, location)')
            .gte('created_at', since)
        ).order('created_at', { ascending: false }).limit(ROW_CAP),
        scope(
          serviceSupabase
            .from('coin_payments')
            .select('id, created_at, amount_in_paisa, dispensed, products(name), vending_machines(name, location)')
            .gte('created_at', since)
        ).order('created_at', { ascending: false }).limit(ROW_CAP),
        scope(
          serviceSupabase
            .from('rfid_payments')
            .select('id, created_at, amount_in_paisa, dispensed, card_uid, products(name), vending_machines(name, location), rfid_cards(holder_name)')
            .gte('created_at', since)
        ).order('created_at', { ascending: false }).limit(ROW_CAP),
      ]);

  // One unified row shape for every payment type
  const all: TxRow[] = [
    ...(online || []).map((t: any) => {
      const items = typeof t.items === 'string' ? JSON.parse(t.items) : t.items || [];
      const status: TxStatus = t.payment_status === 'paid' ? 'paid' : t.payment_status === 'failed' ? 'failed' : 'pending';
      return {
        id: String(t.id), type: 'upi' as const, at: t.created_at,
        customer: t.profiles?.email || 'Guest (QR)',
        product: items.map((i: any) => `${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`).join(', ') || '—',
        machine: t.vending_machines?.name || 'Unknown', location: t.vending_machines?.location || '',
        amount: parseFloat(t.total_amount || 0), status, reference: t.razorpay_payment_id || '',
      };
    }),
    ...(coin || []).map((t: any) => ({
      id: String(t.id), type: 'coin' as const, at: t.created_at,
      customer: 'Coin', product: t.products?.name || '—',
      machine: t.vending_machines?.name || 'Unknown', location: t.vending_machines?.location || '',
      amount: (t.amount_in_paisa || 0) / 100, status: (t.dispensed ? 'dispensed' : 'not_dispensed') as TxStatus, reference: '',
    })),
    ...(rfid || []).map((t: any) => ({
      id: String(t.id), type: 'rfid' as const, at: t.created_at,
      customer: t.rfid_cards?.holder_name || 'RFID card', product: t.products?.name || '—',
      machine: t.vending_machines?.name || 'Unknown', location: t.vending_machines?.location || '',
      amount: (t.amount_in_paisa || 0) / 100, status: (t.dispensed ? 'dispensed' : 'not_dispensed') as TxStatus, reference: t.card_uid || '',
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const ok = (r: TxRow) => r.status === 'paid' || r.status === 'dispensed';
  const inWindow = (r: TxRow) => new Date(r.at).getTime() >= start;
  const cur = all.filter(inWindow);
  const prev = all.filter((r) => !inWindow(r));

  const revenue = cur.filter(ok).reduce((s, r) => s + r.amount, 0);
  const prevRevenue = prev.filter(ok).reduce((s, r) => s + r.amount, 0);
  const count = cur.filter(ok).length;
  const prevCount = prev.filter(ok).length;
  const issues = cur.filter((r) => !ok(r));
  const avg = count ? revenue / count : 0;

  const byType = (t: TxRow['type']) => cur.filter((r) => r.type === t && ok(r)).reduce((s, r) => s + r.amount, 0);
  const daily = dailySeries(cur.filter(ok).map((r) => ({ at: r.at, amount: r.amount })), range);
  const spark = daily.slice(-7).map((d) => d.value);

  const rank = (key: 'machine' | 'product' | 'location') =>
    Object.entries(
      cur.filter(ok).reduce<Record<string, number>>((acc, r) => {
        acc[r[key]] = (acc[r[key]] || 0) + r.amount;
        return acc;
      }, {})
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value]) => ({ label, value }));

  // Busiest hours (IST) — helps plan refills
  const hours = Array.from({ length: 24 }, () => 0);
  for (const r of cur.filter(ok)) {
    const h = Number(new Date(r.at).toLocaleString('en-IN', { hour: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' })) % 24;
    hours[h]++;
  }
  const peak = hours.indexOf(Math.max(...hours));
  const fmtHour = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`;

  const rangeLabel = `last ${range} days`;

  // Busiest weekdays (IST) for the radar
  const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const byWeekday = WEEK.map((label) => ({ label, value: 0 }));
  for (const r of cur.filter(ok)) byWeekday[(new Date(new Date(r.at).getTime() + 5.5 * 3_600_000).getUTCDay() + 6) % 7].value += r.amount;

  const topMachine = rank('machine')[0];
  const topProduct = rank('product')[0];
  const topLocation = rank('location').filter((l) => l.label)[0];
  const methods = [
    { label: 'UPI', value: byType('upi'), n: cur.filter((r) => r.type === 'upi' && ok(r)).length },
    { label: 'Coin', value: byType('coin'), n: cur.filter((r) => r.type === 'coin' && ok(r)).length },
    { label: 'RFID', value: byType('rfid'), n: cur.filter((r) => r.type === 'rfid' && ok(r)).length },
  ].sort((a, b) => b.value - a.value)[0];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-6">
      <PageHeader
        eyebrow="Payments"
        title="Transactions"
        subtitle={`Every UPI, coin and RFID payment — ${rangeLabel}`}
        actions={
          <nav className="tx-range" aria-label="Date range">
            {RANGES.map((r) => (
              <Link key={r} href={`?range=${r}`} scroll={false} aria-current={r === range ? 'page' : undefined} className={r === range ? 'is-active' : ''}>
                {r}D
              </Link>
            ))}
          </nav>
        }
      />

      <StatGrid>
        <StatTile tone="mint"   icon={IndianRupee}   label="Revenue"      value={inr(revenue)} sub={pctChange(revenue, prevRevenue)} spark={spark} />
        <StatTile tone="sky"    icon={ShoppingBag}   label="Successful"   value={count.toLocaleString('en-IN')} sub={pctChange(count, prevCount)} />
        <StatTile tone="lilac"  icon={Receipt}       label="Avg. payment" value={inr(avg, 2)} sub="per successful payment" />
        <StatTile tone="peach"  icon={AlertTriangle} label="Issues"       value={issues.length.toLocaleString('en-IN')} sub="pending, failed or not dispensed" />
      </StatGrid>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-5">
        <Panel title={`Revenue — ${rangeLabel}`}>
          <AreaChart points={daily} format={(n) => inr(n)} />
        </Panel>
        <Panel title="Busiest days">
          <Radar axes={byWeekday} />
          <p className="text-xs text-center text-[var(--muted)] -mt-1">Revenue by weekday · {rangeLabel}</p>
        </Panel>
      </div>

      {/* Top cards (reference "Top platform / source / browser") */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <TopCard icon={Building2} tone="lilac" eyebrow="Top machine" title={topMachine?.label || '—'} value={inr(topMachine?.value || 0)} unit={`${range}d`} />
        <TopCard icon={Package} tone="mint" eyebrow="Top product" title={topProduct?.label || '—'} value={inr(topProduct?.value || 0)} unit={`${range}d`} />
        <TopCard icon={CreditCard} tone="sky" eyebrow="Top payment" title={methods.label} value={methods.n.toLocaleString('en-IN')} unit="payments" />
        <TopCard icon={MapPin} tone="peach" eyebrow="Top location" title={topLocation?.label || '—'} value={inr(topLocation?.value || 0)} unit={`${range}d`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Panel title="Payment mix">
          <Donut
            centerValue={inr(revenue)}
            centerLabel="COLLECTED"
            slices={[
              { label: 'UPI', value: byType('upi'), color: '#a1a1aa' },
              { label: 'Coin', value: byType('coin'), color: '#f0be3c' },
              { label: 'RFID', value: byType('rfid'), color: '#f27860' },
            ]}
          />
        </Panel>
        <Panel title="Top machines">
          <BarList items={rank('machine')} format={(n) => inr(n)} />
        </Panel>
        <Panel title="Busiest hours (IST)">
          {count > 0 ? (
            <>
              <div className="tx-hours" role="img" aria-label={`Peak hour ${fmtHour(peak)}`}>
                {hours.map((v, h) => (
                  <span key={h} title={`${fmtHour(h)}: ${v} payments`} className={h === peak ? 'is-peak' : ''} style={{ height: `${Math.max(4, (v / Math.max(...hours)) * 100)}%` }} />
                ))}
              </div>
              <div className="tx-hours-axis"><span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span></div>
              <p className="text-xs mt-3 text-[var(--muted)]">Peak around <b className="text-[var(--fg)]">{fmtHour(peak)}</b> — plan refills before then.</p>
            </>
          ) : (
            <p className="ui-empty-hint py-6 text-center">No data yet</p>
          )}
        </Panel>
      </div>

      <TransactionsExplorer rows={cur} rangeLabel={rangeLabel} />
    </main>
  );
}
