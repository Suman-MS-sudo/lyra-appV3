import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js';
import { ArrowUpRight, CheckCircle2, Coins, FileText, Nfc, PiggyBank } from 'lucide-react';
import { PageHeader, Panel, StatGrid, StatTile, inr } from '@/components/ui/kit';
import { visibleOwnerIds } from '@/lib/machine-scope';
import { istMonth, periodLabel } from '@/lib/billing';

export const revalidate = 0;

const RANGES = {
  this: { label: 'This month', from: 0, to: 0 },
  last: { label: 'Last month', from: -1, to: -1 },
  '3m': { label: '3 months', from: -2, to: 0 },
} as const;
type RangeKey = keyof typeof RANGES;

const clock = () => Date.now();
const istDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });

/** Count and sum every dispensed payment in [from, to) — paged, so totals never stop at the 1000-row API cap. */
async function totals(db: SupabaseClient, table: 'coin_payments' | 'rfid_payments', machineIds: string[], from: Date, to: Date) {
  let count = 0, paisa = 0;
  if (!machineIds.length) return { count, paisa };
  for (let page = 0; page < 100; page++) {
    const { data } = await db.from(table).select('amount_in_paisa')
      .in('machine_id', machineIds).eq('dispensed', true)
      .gte('created_at', from.toISOString()).lt('created_at', to.toISOString())
      .order('created_at', { ascending: true })
      .range(page * 1000, page * 1000 + 999);
    if (!data?.length) break;
    count += data.length;
    paisa += data.reduce((t, r) => t + (r.amount_in_paisa || 0), 0);
    if (data.length < 1000) break;
  }
  return { count, paisa };
}

export default async function CustomerBillingPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const db = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: profile } = await db.from('profiles').select('id, role, account_type, organization_id').eq('id', user.id).single();
  if (profile?.role === 'admin') redirect('/admin/dashboard');
  const isSuper = profile?.account_type === 'super_customer' && !!profile.organization_id;

  const now = clock();
  const rangeKey: RangeKey = params.range && params.range in RANGES ? (params.range as RangeKey) : 'this';
  const range = RANGES[rangeKey];
  const from = istMonth(range.from, now).start;
  const to = new Date(Math.min(istMonth(range.to, now).end.getTime(), now + 1));

  // Super customers: every company machine (incl. ones assigned to team members); others: their own
  const ownerIds = await visibleOwnerIds(db, user.id, profile);
  const { data: machines } = await db.from('vending_machines').select('id').in('customer_id', ownerIds);
  const machineIds = (machines || []).map((m) => m.id);

  const recent = (table: 'coin_payments' | 'rfid_payments') => machineIds.length
    ? db.from(table).select('id, amount_in_paisa, created_at, vending_machines(name, location)')
      .in('machine_id', machineIds).eq('dispensed', true)
      .gte('created_at', from.toISOString()).lt('created_at', to.toISOString())
      .order('created_at', { ascending: false }).limit(50)
    : Promise.resolve({ data: [] as never[] });

  const [coin, rfid, coinRecent, rfidRecent, statementsQ] = await Promise.all([
    totals(db, 'coin_payments', machineIds, from, to),
    totals(db, 'rfid_payments', machineIds, from, to),
    recent('coin_payments'),
    recent('rfid_payments'),
    // Coin statements are company-level: shown to the super customer
    isSuper
      ? db.from('organization_invoices')
        .select('id, invoice_number, period_start, total_coin_transactions, total_amount_paisa, amount_due_paisa, status, paid_at')
        .eq('organization_id', profile!.organization_id)
        .in('status', ['pending', 'paid', 'overdue'])
        .order('period_start', { ascending: false }).limit(24)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  type Activity = { id: string; type: 'coin' | 'rfid'; at: string; amount: number; machine: string; location: string };
  const toActivity = (type: Activity['type']) => (r: { id: string; amount_in_paisa: number | null; created_at: string; vending_machines: unknown }): Activity => {
    const vm = r.vending_machines as { name?: string; location?: string } | null;
    return { id: `${type}-${r.id}`, type, at: r.created_at, amount: r.amount_in_paisa || 0, machine: vm?.name || 'Machine', location: vm?.location || '' };
  };
  const activity = [...(coinRecent.data || []).map(toActivity('coin')), ...(rfidRecent.data || []).map(toActivity('rfid'))]
    .sort((a, b) => b.at.localeCompare(a.at)).slice(0, 50);

  const statements = statementsQ.data || [];
  const awaiting = statements.filter((s) => s.status !== 'paid' && s.total_amount_paisa > 0);
  const awaitingPaisa = awaiting.reduce((t, s) => t + s.amount_due_paisa, 0);
  const collectedPaisa = statements.filter((s) => s.status === 'paid').reduce((t, s) => t + s.total_amount_paisa, 0);

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-8 py-6 space-y-6">
      <PageHeader title="Billing" subtitle="Coin and RFID payments on your machines, and the coins Lyra collects" />

      <nav className="ui-pills" aria-label="Period">
        {(Object.keys(RANGES) as RangeKey[]).map((k) => (
          <Link key={k} href={`?range=${k}`} scroll={false} className={k === rangeKey ? 'is-active' : ''} aria-current={k === rangeKey ? 'page' : undefined}>{RANGES[k].label}</Link>
        ))}
      </nav>

      <StatGrid>
        <StatTile tone="butter" icon={Coins} label="Coin payments" value={inr(coin.paisa / 100)} sub={`${coin.count.toLocaleString('en-IN')} coins · ${range.label.toLowerCase()}`} />
        <StatTile tone="lilac" icon={Nfc} label="RFID taps" value={rfid.count.toLocaleString('en-IN')} sub={`${inr(rfid.paisa / 100)} in card credit`} />
        {isSuper ? (
          <>
            <StatTile tone="peach" icon={PiggyBank} label="Awaiting collection" value={inr(awaitingPaisa / 100)} sub={awaiting.length ? `${awaiting.length} statement${awaiting.length === 1 ? '' : 's'} · Lyra collects` : 'nothing pending'} />
            <StatTile tone="mint" icon={CheckCircle2} label="Collected by Lyra" value={inr(collectedPaisa / 100)} sub={`last ${statements.length} statement${statements.length === 1 ? '' : 's'}`} />
          </>
        ) : (
          <StatTile tone="sky" icon={FileText} label="Machines" value={String(machineIds.length)} sub="assigned to you" />
        )}
      </StatGrid>

      {isSuper && (
        <Panel title="Coin collection statements" flush>
          <p className="px-5 -mt-2 pb-3 text-xs text-[var(--muted)]">Coins in your machines are cash that Lyra staff collect each month. Nothing is due from you.</p>
          <ul className="m-cards sm:hidden">
            {statements.map((s) => {
              const nil = s.total_amount_paisa === 0, done = s.status === 'paid' && !nil;
              return (
                <li key={s.id} className="m-card">
                  <Link href={`/customer/billing/${s.id}`} className="block">
                    <div className="m-card-row"><p className="m-card-title">{periodLabel(s.period_start)}</p><p className="m-card-num">{inr(s.total_amount_paisa / 100, 2)}</p></div>
                    <div className="m-card-row mt-2">
                      <span className={`ui-pill ${done || nil ? 'is-ok' : 'is-warn'}`}><span className="ui-pill-dot" />{nil ? 'No coins' : done ? 'Collected' : 'Awaiting collection'}</span>
                      <span className="m-card-meta">{s.invoice_number}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
            {statements.length === 0 && <li className="py-10 text-center text-sm text-[var(--muted)]">No statements yet</li>}
          </ul>
          <div className="overflow-x-auto hidden sm:block">
            <table className="w-full text-sm tx-table">
              <thead><tr><th className="text-left">Month</th><th className="text-left">Statement</th><th className="text-right">Coins</th><th className="text-right">Amount</th><th className="text-left">Status</th><th /></tr></thead>
              <tbody>
                {statements.map((s) => {
                  const nil = s.total_amount_paisa === 0, done = s.status === 'paid' && !nil;
                  return (
                    <tr key={s.id}>
                      <td className="font-medium text-[var(--fg)]">{periodLabel(s.period_start)}</td>
                      <td className="text-[var(--muted)]">{s.invoice_number}</td>
                      <td className="text-right">{(s.total_coin_transactions || 0).toLocaleString('en-IN')}</td>
                      <td className="text-right font-semibold text-[var(--fg)]">{inr(s.total_amount_paisa / 100, 2)}</td>
                      <td><span className={`ui-pill ${done || nil ? 'is-ok' : 'is-warn'}`}><span className="ui-pill-dot" />{nil ? 'No coins' : done ? 'Collected' : 'Awaiting collection'}</span></td>
                      <td className="text-right"><Link href={`/customer/billing/${s.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-ink)] hover:underline">View <ArrowUpRight className="w-3 h-3" /></Link></td>
                    </tr>
                  );
                })}
                {statements.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-[var(--muted)]">No statements yet. The first one appears on the 1st of next month.</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Panel title="Coin & RFID payments" flush>
        <p className="px-5 -mt-2 pb-3 text-xs text-[var(--muted)]">{range.label} · latest {activity.length} of {(coin.count + rfid.count).toLocaleString('en-IN')} · times in IST</p>
        <ul className="m-cards sm:hidden">
          {activity.map((a) => (
            <li key={a.id} className="m-card">
              <div className="m-card-row"><p className="m-card-title">{a.machine}</p><p className="m-card-num">{inr(a.amount / 100, 2)}</p></div>
              <div className="m-card-row mt-2">
                <span className={`tx-type ${a.type === 'coin' ? 'db-tone-butter' : 'db-tone-peach'}`}>{a.type === 'coin' ? <Coins className="w-3.5 h-3.5" /> : <Nfc className="w-3.5 h-3.5" />}{a.type === 'coin' ? 'Coin' : 'RFID'}</span>
                <span className="m-card-meta">{istDateTime(a.at)}</span>
              </div>
            </li>
          ))}
          {activity.length === 0 && <li className="py-10 text-center text-sm text-[var(--muted)]">No coin or RFID payments in this period</li>}
        </ul>
        <div className="overflow-x-auto hidden sm:block">
          <table className="w-full text-sm tx-table">
            <thead><tr><th className="text-left">Date & time</th><th className="text-left">Machine</th><th className="text-left">Type</th><th className="text-right">Amount</th></tr></thead>
            <tbody>
              {activity.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap text-[var(--muted)]">{istDateTime(a.at)}</td>
                  <td><p className="font-medium text-[var(--fg)]">{a.machine}</p>{a.location && <p className="text-xs text-[var(--subtle)]">{a.location}</p>}</td>
                  <td><span className={`tx-type ${a.type === 'coin' ? 'db-tone-butter' : 'db-tone-peach'}`}>{a.type === 'coin' ? <Coins className="w-3.5 h-3.5" /> : <Nfc className="w-3.5 h-3.5" />}{a.type === 'coin' ? 'Coin' : 'RFID'}</span></td>
                  <td className="text-right font-semibold text-[var(--fg)]">{inr(a.amount / 100, 2)}</td>
                </tr>
              ))}
              {activity.length === 0 && <tr><td colSpan={4} className="py-12 text-center text-[var(--muted)]">No coin or RFID payments in this period</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </main>
  );
}
