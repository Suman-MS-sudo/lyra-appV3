import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { AlertTriangle, Banknote, CalendarClock, CheckCircle2, Coins, Mail, PiggyBank, Timer, TrendingUp } from 'lucide-react';
import { PaymentSuccessBanner } from '@/components/PaymentSuccessBanner';
import { ManualInvoiceGenerator } from '@/components/ManualInvoiceGenerator';
import { GenerateMonthlyInvoicesButton } from '@/components/GenerateMonthlyInvoicesButton';
import StatementsExplorer, { type StatementRow } from '@/components/StatementsExplorer';
import { BarList, PageHeader, Panel, StatGrid, StatTile, inr } from '@/components/ui/kit';
import { VxAreaChart } from '@/components/ui/vision';
import {
  COLLECTION_WINDOW_DAYS, billingDb, billingReportRecipients, formatIstDate, istMonth, nextBillingRun, periodLabel,
} from '@/lib/billing';
import { IST_OFFSET_MS } from '@/lib/time';

export const revalidate = 0;

const RANGES = {
  this: { label: 'This month', from: 0, to: 0 },
  last: { label: 'Last month', from: -1, to: -1 },
  '3m': { label: '3 months', from: -2, to: 0 },
  '6m': { label: '6 months', from: -5, to: 0 },
  '12m': { label: '12 months', from: -11, to: 0 },
} as const;
type RangeKey = keyof typeof RANGES;

// Clock read outside the component (render stays pure)
const clock = () => Date.now();
const monthKey = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + IST_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};
const keyOfOffset = (offset: number, now: number) => monthKey(istMonth(offset, now).start.toISOString());
const shortMonth = (offset: number, now: number) =>
  new Date(istMonth(offset, now).start.getTime() + IST_OFFSET_MS).toLocaleDateString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' });
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ payment?: string; range?: string; status?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const db = billingDb();
  const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/customer/dashboard');

  const now = clock();
  const rangeKey: RangeKey = params.range && params.range in RANGES ? (params.range as RangeKey) : '3m';
  const range = RANGES[rangeKey];
  const span = range.to - range.from + 1;
  const winStart = istMonth(range.from, now).start;
  const winEnd = istMonth(range.to, now).end;
  const prevStart = istMonth(range.from - span, now).start;
  const chartMonths = Math.max(6, span);
  const loadFrom = istMonth(Math.min(range.from - span, -(chartMonths - 1)), now).start;

  const [orgsQ, machinesQ, membersQ, summaryQ, statementsQ, collectionsQ, runsQ] = await Promise.all([
    db.from('organizations').select('id, name').order('name'),
    db.from('vending_machines').select('customer_id'),
    db.from('profiles').select('id, organization_id').not('organization_id', 'is', null),
    db.rpc('coin_collection_summary', { p_from: loadFrom.toISOString(), p_to: istMonth(1, now).start.toISOString() }),
    db.from('organization_invoices')
      .select('id, invoice_number, organization_id, period_start, total_coin_transactions, total_amount_paisa, amount_due_paisa, status, due_date, created_at, paid_at, organizations(name)')
      .order('period_start', { ascending: false }).order('created_at', { ascending: false }).limit(5000),
    db.from('organization_payments').select('invoice_id, organization_id, amount_paisa, payment_date').eq('status', 'success').gte('payment_date', loadFrom.toISOString()).limit(10000),
    db.from('billing_runs').select('run_at, triggered_by, period_start, invoices_created, invoices_failed, emails_sent, overdue_marked').order('run_at', { ascending: false }).limit(5),
  ]);
  const migrationMissing = !!summaryQ.error;

  const orgs = orgsQ.data || [];
  const orgName = new Map(orgs.map((o) => [o.id, o.name as string]));
  const orgOfMember = new Map((membersQ.data || []).map((p) => [String(p.id), String(p.organization_id)]));
  const machinesByOrg = new Map<string, number>();
  for (const m of machinesQ.data || []) {
    const org = orgOfMember.get(String(m.customer_id)) || String(m.customer_id);
    if (orgName.has(org)) machinesByOrg.set(org, (machinesByOrg.get(org) || 0) + 1);
  }

  // ── System coin totals (from the machines) per org per month ──
  type Cell = { coins: number; paisa: number };
  const coinBy = new Map<string, Cell>(); // `${org}|${YYYY-MM}`
  const coinMonth = new Map<string, Cell>();
  for (const r of (summaryQ.data || []) as { organization_id: string | null; month: string; coins: number; amount_paisa: number }[]) {
    const k = String(r.month).slice(0, 7);
    const add = (map: Map<string, Cell>, key: string) => {
      const c = map.get(key) || { coins: 0, paisa: 0 };
      c.coins += Number(r.coins); c.paisa += Number(r.amount_paisa);
      map.set(key, c);
    };
    add(coinMonth, k);
    if (r.organization_id) add(coinBy, `${r.organization_id}|${k}`);
  }
  const winKeys = Array.from({ length: span }, (_, i) => keyOfOffset(range.from + i, now));
  const prevKeys = Array.from({ length: span }, (_, i) => keyOfOffset(range.from - span + i, now));
  const sumKeys = (keys: string[], org?: string) => keys.reduce((t, k) => {
    const c = org ? coinBy.get(`${org}|${k}`) : coinMonth.get(k);
    return { coins: t.coins + (c?.coins || 0), paisa: t.paisa + (c?.paisa || 0) };
  }, { coins: 0, paisa: 0 });

  // ── Cash collected (recorded collections) ──
  const collections = collectionsQ.data || [];
  const inWin = (iso: string, a: Date, b: Date) => { const t = new Date(iso).getTime(); return t >= a.getTime() && t < b.getTime(); };
  const collectedWin = collections.filter((c) => inWin(c.payment_date, winStart, winEnd));
  const collectedPrev = collections.filter((c) => inWin(c.payment_date, prevStart, winStart));
  const cashByMonth = new Map<string, number>();
  for (const c of collections) cashByMonth.set(monthKey(c.payment_date), (cashByMonth.get(monthKey(c.payment_date)) || 0) + c.amount_paisa);
  const paidByInvoice = new Map<string, number>();
  for (const c of collections) paidByInvoice.set(c.invoice_id, (paidByInvoice.get(c.invoice_id) || 0) + c.amount_paisa);

  // ── Statements ──
  const statements = statementsQ.data || [];
  const live = statements.filter((s) => s.status !== 'cancelled');
  const outstanding = live.filter((s) => (s.status === 'pending' || s.status === 'overdue') && s.amount_due_paisa > 0);
  const overdue = outstanding.filter((s) => s.status === 'overdue');
  const winStatements = live.filter((s) => inWin(s.period_start, winStart, winEnd) && s.total_amount_paisa > 0);
  const winExpected = winStatements.reduce((t, s) => t + s.total_amount_paisa, 0);
  const winStillDue = winStatements.reduce((t, s) => t + (s.status === 'paid' ? 0 : s.amount_due_paisa), 0);
  const settledWin = winStatements.filter((s) => s.status === 'paid');
  const variance = settledWin.reduce((t, s) => t + ((paidByInvoice.get(s.id) || 0) - s.total_amount_paisa), 0);

  const coinsWin = sumKeys(winKeys);
  const coinsPrev = sumKeys(prevKeys);
  const cashWin = collectedWin.reduce((t, c) => t + c.amount_paisa, 0);
  const cashPrev = collectedPrev.reduce((t, c) => t + c.amount_paisa, 0);
  const change = (a: number, b: number) => (b > 0 ? `${a >= b ? '+' : ''}${Math.round(((a - b) / b) * 100)}% vs previous ${span === 1 ? 'month' : `${span} months`}` : 'no previous data');

  // ── Monthly chart ──
  const chartOffsets = Array.from({ length: chartMonths }, (_, i) => i - (chartMonths - 1));
  const chartLabels = chartOffsets.map((o) => shortMonth(o, now));
  const chartCoins = chartOffsets.map((o) => (coinMonth.get(keyOfOffset(o, now))?.paisa || 0) / 100);
  const chartCash = chartOffsets.map((o) => (cashByMonth.get(keyOfOffset(o, now)) || 0) / 100);

  // ── Ageing of uncollected coins ──
  const DAY = 86_400_000;
  const buckets = [
    { label: 'Not yet due', test: (d: number) => d <= 0 },
    { label: '1–15 days overdue', test: (d: number) => d > 0 && d <= 15 },
    { label: '16–30 days overdue', test: (d: number) => d > 15 && d <= 30 },
    { label: '31–60 days overdue', test: (d: number) => d > 30 && d <= 60 },
    { label: 'Over 60 days overdue', test: (d: number) => d > 60 },
  ].map((b) => {
    const rows = outstanding.filter((s) => b.test(Math.floor((now - new Date(s.due_date || s.created_at).getTime()) / DAY)));
    return { label: b.label, value: rows.reduce((t, s) => t + s.amount_due_paisa, 0) / 100, sub: `${rows.length} statement${rows.length === 1 ? '' : 's'}` };
  });

  // ── Per-organization table ──
  const orgRows = orgs.map((o) => {
    const cur = sumKeys(winKeys, o.id);
    const prev = sumKeys(prevKeys, o.id);
    const cash = collectedWin.filter((c) => c.organization_id === o.id).reduce((t, c) => t + c.amount_paisa, 0);
    const due = outstanding.filter((s) => s.organization_id === o.id).reduce((t, s) => t + s.amount_due_paisa, 0);
    const late = overdue.some((s) => s.organization_id === o.id);
    return { id: o.id, name: o.name as string, machines: machinesByOrg.get(o.id) || 0, coins: cur.coins, paisa: cur.paisa, prev: prev.paisa, cash, due, late };
  }).filter((r) => r.machines || r.paisa || r.due || r.cash).sort((a, b) => b.paisa - a.paisa || b.due - a.due);

  // ── Statements list ──
  const rows: StatementRow[] = statements.map((s) => ({
    id: s.id,
    number: s.invoice_number,
    organization: (s.organizations as unknown as { name: string } | null)?.name || orgName.get(s.organization_id) || 'Organization',
    month: periodLabel(s.period_start),
    monthKey: monthKey(s.period_start),
    coins: s.total_coin_transactions || 0,
    expected: s.total_amount_paisa,
    due: s.status === 'paid' || s.status === 'cancelled' ? 0 : s.amount_due_paisa,
    status: s.status === 'cancelled' ? 'cancelled' : s.total_amount_paisa === 0 ? 'nil' : s.status === 'paid' ? 'collected' : s.status === 'overdue' ? 'overdue' : 'to_collect',
    collectBy: s.due_date ? formatIstDate(s.due_date) : null,
    createdAt: s.created_at,
  }));

  const recipients = billingReportRecipients();
  const cronReady = !!process.env.CRON_SECRET;
  const lastMonth = istMonth(-1, now);
  const lastMonthDone = live.some((s) => s.period_start === lastMonth.start.toISOString());

  return (
    <main className="max-w-[1500px] mx-auto px-4 sm:px-8 py-6 space-y-6">
      {params.payment === 'success' && <PaymentSuccessBanner />}

      <PageHeader
        title="Billing"
        subtitle="Monthly coin collection statements: coins Lyra collects from each organization's machines"
        actions={<><ManualInvoiceGenerator /><GenerateMonthlyInvoicesButton /></>}
      />

      {migrationMissing && (
        <p role="alert" className="p-4 rounded-xl text-sm bg-[var(--warning-bg)] text-[var(--warning)]">
          The billing database update hasn&apos;t been applied yet. Run <code>supabase/migrations/20261101000001_billing_automation.sql</code> in the Supabase SQL editor to enable totals, automation and overdue tracking.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="ui-pills" aria-label="Period">
          {(Object.keys(RANGES) as RangeKey[]).map((k) => (
            <Link key={k} href={`?range=${k}`} scroll={false} className={k === rangeKey ? 'is-active' : ''} aria-current={k === rangeKey ? 'page' : undefined}>{RANGES[k].label}</Link>
          ))}
        </nav>
        <p className="text-xs text-[var(--muted)]">
          {formatIstDate(winStart)} – {formatIstDate(new Date(Math.min(winEnd.getTime(), now) - 1))}
        </p>
      </div>

      <StatGrid>
        <StatTile tone="butter" icon={Coins} label="Coins in machines" value={inr(coinsWin.paisa / 100)} sub={`${coinsWin.coins.toLocaleString('en-IN')} coins · ${change(coinsWin.paisa, coinsPrev.paisa)}`} />
        <StatTile tone="mint" icon={Banknote} label="Cash collected" value={inr(cashWin / 100)} sub={change(cashWin, cashPrev)} />
        <StatTile tone="peach" icon={PiggyBank} label="Still to collect" value={inr(outstanding.reduce((t, s) => t + s.amount_due_paisa, 0) / 100)} sub={overdue.length ? `${overdue.length} overdue · ${inr(overdue.reduce((t, s) => t + s.amount_due_paisa, 0) / 100)}` : `${outstanding.length} statement${outstanding.length === 1 ? '' : 's'}, none overdue`} />
        <StatTile tone="sky" icon={TrendingUp} label="Collection rate" value={`${pct(winExpected - winStillDue, winExpected)}%`} sub={settledWin.length ? `count variance ${variance >= 0 ? '+' : '−'}${inr(Math.abs(variance) / 100, 2)}` : `of ${inr(winExpected / 100)} expected`} />
      </StatGrid>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-6">
        <Panel title="Coins vs cash collected">
          <div className="flex flex-wrap items-center justify-between gap-3 -mt-2 mb-4">
            <p className="text-sm text-[var(--muted)]">Last {chartMonths} months · coins recorded by the machines and cash recorded at collection</p>
            <div className="vx-legend"><span><i style={{ background: '#0075ff' }} />Coins in machines</span><span><i style={{ background: '#2cd9ff' }} />Cash collected</span></div>
          </div>
          <VxAreaChart labels={chartLabels} series={[{ name: 'Coins', values: chartCoins, color: '#0075ff' }, { name: 'Collected', values: chartCash, color: '#2cd9ff' }]} format={(n) => inr(n)} />
        </Panel>

        <Panel title="Automation">
          <ul className="ui-list">
            <li className="ui-row">
              <span className={`ui-row-icon db-row-icon ${cronReady ? 'db-tone-mint' : 'db-tone-peach'}`}>{cronReady ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}</span>
              <span className="min-w-0">
                <span className="ui-row-title">{cronReady ? 'Monthly statements are automatic' : 'Automation not configured'}</span>
                <span className="ui-row-meta">{cronReady ? 'Runs daily at 00:00 IST · creates statements on the 1st' : 'Set CRON_SECRET in Vercel to enable the daily run'}</span>
              </span>
            </li>
            <li className="ui-row">
              <span className="ui-row-icon db-row-icon db-tone-sky"><CalendarClock className="w-4 h-4" /></span>
              <span className="min-w-0">
                <span className="ui-row-title">Next statements: {formatIstDate(nextBillingRun(now))}</span>
                <span className="ui-row-meta">{lastMonthDone ? `${lastMonth.label} statements created` : `${lastMonth.label} not created yet. Use “Run billing”.`}</span>
              </span>
            </li>
            <li className="ui-row">
              <span className="ui-row-icon db-row-icon db-tone-lilac"><Mail className="w-4 h-4" /></span>
              <span className="min-w-0">
                <span className="ui-row-title">Collection sheet goes to</span>
                <span className="ui-row-meta">{recipients.length ? recipients.join(', ') : 'Nobody: set BILLING_REPORT_EMAIL'}</span>
              </span>
            </li>
            <li className="ui-row">
              <span className="ui-row-icon db-row-icon db-tone-butter"><Timer className="w-4 h-4" /></span>
              <span className="min-w-0">
                <span className="ui-row-title">Collect within {COLLECTION_WINDOW_DAYS} days</span>
                <span className="ui-row-meta">Then marked overdue; Lyra gets an uncollected digest every Monday</span>
              </span>
            </li>
          </ul>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--subtle)] mt-5 mb-2">Recent runs</p>
          {runsQ.data?.length ? (
            <ul className="space-y-2 text-xs">
              {runsQ.data.map((r) => (
                <li key={r.run_at} className="flex justify-between gap-3">
                  <span className="text-[var(--fg-2)]">{formatIstDate(r.run_at)} · {r.triggered_by === 'cron' ? 'automatic' : r.triggered_by}</span>
                  <span className="text-[var(--muted)] text-right">
                    {r.period_start ? `${periodLabel(r.period_start)}: ${r.invoices_created} created` : 'upkeep'}
                    {r.invoices_failed ? `, ${r.invoices_failed} failed` : ''}{r.overdue_marked ? `, ${r.overdue_marked} overdue` : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="text-xs text-[var(--muted)]">No runs recorded yet.</p>}
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-6">
        <Panel title={`Organizations · ${range.label.toLowerCase()}`} flush>
          <div className="overflow-x-auto">
            <table className="w-full text-sm tx-table">
              <thead>
                <tr>
                  <th className="text-left">Organization</th>
                  <th className="text-right hidden sm:table-cell">Machines</th>
                  <th className="text-right">Coins in machines</th>
                  <th className="text-right hidden md:table-cell">Collected</th>
                  <th className="text-right">To collect</th>
                  <th className="text-right hidden lg:table-cell">vs previous</th>
                </tr>
              </thead>
              <tbody>
                {orgRows.map((r) => {
                  const d = r.prev > 0 ? Math.round(((r.paisa - r.prev) / r.prev) * 100) : null;
                  return (
                    <tr key={r.id}>
                      <td className="font-medium text-[var(--fg)]">{r.name}</td>
                      <td className="text-right hidden sm:table-cell">{r.machines}</td>
                      <td className="text-right font-semibold text-[var(--fg)]">{inr(r.paisa / 100)}<span className="block text-xs font-normal text-[var(--subtle)]">{r.coins.toLocaleString('en-IN')} coins</span></td>
                      <td className="text-right hidden md:table-cell">{r.cash ? inr(r.cash / 100) : '—'}</td>
                      <td className="text-right font-semibold" style={{ color: r.due ? (r.late ? 'var(--danger)' : 'var(--warning)') : 'var(--subtle)' }}>{r.due ? inr(r.due / 100) : '—'}</td>
                      <td className="text-right hidden lg:table-cell" style={{ color: d == null ? 'var(--subtle)' : d >= 0 ? 'var(--success)' : 'var(--danger)' }}>{d == null ? '—' : `${d >= 0 ? '+' : ''}${d}%`}</td>
                    </tr>
                  );
                })}
                {orgRows.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-[var(--muted)]">No coin activity in this period</td></tr>}
              </tbody>
              {orgRows.length > 0 && (
                <tfoot>
                  <tr className="font-bold text-[var(--fg)]">
                    <td>Total</td>
                    <td className="text-right hidden sm:table-cell">{orgRows.reduce((t, r) => t + r.machines, 0)}</td>
                    <td className="text-right">{inr(orgRows.reduce((t, r) => t + r.paisa, 0) / 100)}</td>
                    <td className="text-right hidden md:table-cell">{inr(orgRows.reduce((t, r) => t + r.cash, 0) / 100)}</td>
                    <td className="text-right">{inr(orgRows.reduce((t, r) => t + r.due, 0) / 100)}</td>
                    <td className="hidden lg:table-cell" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Panel>

        <Panel title="Uncollected by age" href="?status=overdue#statements" hrefLabel="Overdue">
          <BarList items={buckets} format={(n) => inr(n)} />
        </Panel>
      </div>

      <div id="statements" className="scroll-mt-6">
        <StatementsExplorer rows={rows} initialStatus={params.status} />
      </div>
    </main>
  );
}
