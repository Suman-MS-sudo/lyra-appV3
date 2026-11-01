'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Coins, CreditCard, Download, Nfc, Search, X } from 'lucide-react';

export type TxType = 'upi' | 'coin' | 'rfid';
export type TxStatus = 'paid' | 'pending' | 'failed' | 'dispensed' | 'not_dispensed';

export interface TxRow {
  id: string;
  type: TxType;
  at: string;
  customer: string;
  product: string;
  machine: string;
  location: string;
  amount: number;
  status: TxStatus;
  reference: string;
}

const PAGE = 25;
const TYPE_META: Record<TxType, { label: string; icon: React.ElementType; tone: string }> = {
  upi: { label: 'UPI', icon: CreditCard, tone: 'sky' },
  coin: { label: 'Coin', icon: Coins, tone: 'butter' },
  rfid: { label: 'RFID', icon: Nfc, tone: 'peach' },
};
const STATUS_META: Record<TxStatus, { label: string; tone: 'ok' | 'warn' | 'bad' }> = {
  paid: { label: 'Paid', tone: 'ok' },
  dispensed: { label: 'Dispensed', tone: 'ok' },
  pending: { label: 'Pending', tone: 'warn' },
  not_dispensed: { label: 'Not dispensed', tone: 'bad' },
  failed: { label: 'Failed', tone: 'bad' },
};

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });

function toCsv(rows: TxRow[]) {
  const head = ['Date (IST)', 'Type', 'Status', 'Amount (INR)', 'Machine', 'Location', 'Product', 'Customer', 'Reference'];
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [when(r.at), TYPE_META[r.type].label, STATUS_META[r.status].label, r.amount.toFixed(2), r.machine, r.location, r.product, r.customer, r.reference].map(cell).join(','),
  );
  return [head.map(cell).join(','), ...lines].join('\n');
}

type Sort = { key: 'at' | 'amount'; dir: 'asc' | 'desc' };

function SortIcon({ sort, k }: { sort: Sort; k: Sort['key'] }) {
  if (sort.key !== k) return null;
  return sort.dir === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />;
}

/** Unified, filterable, sortable transaction table with CSV export. */
export default function TransactionsExplorer({ rows, rangeLabel }: { rows: TxRow[]; rangeLabel: string }) {
  const [type, setType] = useState<'all' | TxType>('all');
  const [status, setStatus] = useState<'all' | 'ok' | 'issue'>('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>({ key: 'at', dir: 'desc' });
  const [page, setPage] = useState(0);

  const counts = useMemo(() => ({
    all: rows.length,
    upi: rows.filter((r) => r.type === 'upi').length,
    coin: rows.filter((r) => r.type === 'coin').length,
    rfid: rows.filter((r) => r.type === 'rfid').length,
  }), [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = rows.filter((r) => {
      if (type !== 'all' && r.type !== type) return false;
      if (status === 'ok' && STATUS_META[r.status].tone !== 'ok') return false;
      if (status === 'issue' && STATUS_META[r.status].tone === 'ok') return false;
      if (needle && !`${r.machine} ${r.location} ${r.product} ${r.customer} ${r.reference}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    const dir = sort.dir === 'asc' ? 1 : -1;
    out.sort((a, b) => (sort.key === 'amount' ? (a.amount - b.amount) * dir : (new Date(a.at).getTime() - new Date(b.at).getTime()) * dir));
    return out;
  }, [rows, type, status, q, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * PAGE, current * PAGE + PAGE);
  const filteredTotal = filtered.reduce((s, r) => s + (STATUS_META[r.status].tone === 'ok' ? r.amount : 0), 0);

  const reset = (fn: () => void) => { fn(); setPage(0); };
  const toggleSort = (key: 'at' | 'amount') =>
    reset(() => setSort((s) => (s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' })));

  const exportCsv = () => {
    const blob = new Blob([toCsv(filtered)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lyra-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="ui-panel is-flush">
      {/* Toolbar */}
      <div className="tx-toolbar">
        <div>
          <h2 className="ui-panel-title">All transactions</h2>
          <p className="text-xs mt-0.5 text-[var(--muted)]">
            {filtered.length.toLocaleString('en-IN')} of {rows.length.toLocaleString('en-IN')} · {rangeLabel} · {inr(filteredTotal)} collected
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="tx-search">
            <Search className="w-4 h-4 text-[var(--subtle)]" />
            <input
              value={q}
              onChange={(e) => reset(() => setQ(e.target.value))}
              placeholder="Search machine, product, customer, payment ID"
              aria-label="Search transactions"
            />
            {q && (
              <button type="button" onClick={() => reset(() => setQ(''))} aria-label="Clear search"><X className="w-3.5 h-3.5" /></button>
            )}
          </label>
          <button type="button" className="tx-btn" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="tx-filters">
        <div className="tx-tabs" role="tablist" aria-label="Payment type">
          {(['all', 'upi', 'coin', 'rfid'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={type === t}
              className={`tx-tab ${type === t ? 'is-active' : ''}`}
              onClick={() => reset(() => setType(t))}
            >
              {t === 'all' ? 'All' : TYPE_META[t].label}
              <span>{counts[t].toLocaleString('en-IN')}</span>
            </button>
          ))}
        </div>
        <div className="tx-tabs" role="tablist" aria-label="Status">
          {([['all', 'Any status'], ['ok', 'Successful'], ['issue', 'Issues']] as const).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={status === k} className={`tx-tab ${status === k ? 'is-active' : ''}`} onClick={() => reset(() => setStatus(k))}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm tx-table">
          <thead>
            <tr>
              <th className="text-left"><button type="button" className="tx-sort" onClick={() => toggleSort('at')}>Date &amp; time <SortIcon sort={sort} k="at" /></button></th>
              <th className="text-left">Machine</th>
              <th className="text-left">Product</th>
              <th className="text-left">Customer</th>
              <th className="text-left">Type</th>
              <th className="text-left">Status</th>
              <th className="text-right"><button type="button" className="tx-sort ml-auto" onClick={() => toggleSort('amount')}>Amount <SortIcon sort={sort} k="amount" /></button></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const T = TYPE_META[r.type];
              const S = STATUS_META[r.status];
              return (
                <tr key={`${r.type}-${r.id}`}>
                  <td className="whitespace-nowrap text-[var(--muted)]">{when(r.at)}</td>
                  <td>
                    <p className="font-medium text-[var(--fg)]">{r.machine}</p>
                    {r.location && <p className="text-xs text-[var(--subtle)]">{r.location}</p>}
                  </td>
                  <td className="text-[var(--fg-2)]">{r.product}</td>
                  <td>
                    <p className="text-[var(--fg-2)]">{r.customer}</p>
                    {r.reference && <p className="text-[11px] font-mono text-[var(--subtle)] truncate max-w-[180px]" title={r.reference}>{r.reference}</p>}
                  </td>
                  <td>
                    <span className={`tx-type db-tone-${T.tone}`}><T.icon className="w-3.5 h-3.5" />{T.label}</span>
                  </td>
                  <td><span className={`ui-pill is-${S.tone}`}><span className="ui-pill-dot" />{S.label}</span></td>
                  <td className="text-right font-semibold text-[var(--fg)] whitespace-nowrap" style={{ fontFeatureSettings: '"tnum" 1' }}>{inr(r.amount)}</td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr><td colSpan={7} className="py-14 text-center text-[var(--muted)]">No transactions match these filters</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {filtered.length > PAGE && (
        <div className="tx-pager">
          <span className="text-xs text-[var(--muted)]">
            {current * PAGE + 1}–{Math.min((current + 1) * PAGE, filtered.length)} of {filtered.length.toLocaleString('en-IN')}
          </span>
          <div className="flex items-center gap-1">
            <button type="button" className="tx-btn is-icon" onClick={() => setPage(current - 1)} disabled={current === 0} aria-label="Previous page"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-xs font-medium text-[var(--fg-2)] px-2">Page {current + 1} / {pages}</span>
            <button type="button" className="tx-btn is-icon" onClick={() => setPage(current + 1)} disabled={current >= pages - 1} aria-label="Next page"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </section>
  );
}
