'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Download, Search } from 'lucide-react';

export interface StatementRow {
  id: string;
  number: string;
  organization: string;
  month: string;
  monthKey: string;
  coins: number;
  expected: number;   // paisa
  due: number;        // paisa still to collect
  status: 'to_collect' | 'overdue' | 'collected' | 'nil' | 'cancelled';
  collectBy: string | null;
  createdAt: string;
}

const STATUS = {
  to_collect: { label: 'To collect', tone: 'warn' },
  overdue: { label: 'Overdue', tone: 'bad' },
  collected: { label: 'Collected', tone: 'ok' },
  nil: { label: 'No coins', tone: 'muted' },
  cancelled: { label: 'Cancelled', tone: 'muted' },
} as const;
const TABS: { key: 'all' | StatementRow['status']; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'to_collect', label: 'To collect' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'collected', label: 'Collected' },
  { key: 'nil', label: 'No coins' },
];
const PAGE = 20;
const inr = (p: number) => `₹${(p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function StatementsExplorer({ rows, initialStatus = 'all' }: { rows: StatementRow[]; initialStatus?: string }) {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>(TABS.some((t) => t.key === initialStatus) ? (initialStatus as StatementRow['status']) : 'all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => (tab === 'all' || r.status === tab)
      && (!term || `${r.number} ${r.organization} ${r.month}`.toLowerCase().includes(term)));
  }, [rows, tab, q]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const visible = filtered.slice(page * PAGE, page * PAGE + PAGE);

  const exportCsv = () => {
    const head = 'Statement,Organization,Month,Coins,Expected (INR),Still to collect (INR),Status,Collect by';
    const body = filtered.map((r) => [r.number, r.organization, r.month, r.coins, (r.expected / 100).toFixed(2), (r.due / 100).toFixed(2), STATUS[r.status].label, r.collectBy || '']
      .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const url = URL.createObjectURL(new Blob([[head, ...body].join('\n')], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `lyra-coin-statements-${tab}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="ui-panel is-flush">
      <div className="tx-toolbar">
        <div>
          <h2 className="ui-panel-title">Statements</h2>
          <p className="text-xs mt-0.5 text-[var(--muted)]">{filtered.length} of {rows.length} · monthly coin collection statements</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="tx-search">
            <Search className="w-4 h-4 text-[var(--subtle)]" />
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Search statement, organization, month…" aria-label="Search statements" />
          </label>
          <button type="button" className="tx-btn" onClick={exportCsv} disabled={!filtered.length}><Download className="w-4 h-4" /> CSV</button>
        </div>
      </div>
      <div className="tx-filters">
        <div className="tx-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`tx-tab ${tab === t.key ? 'is-active' : ''}`} onClick={() => { setTab(t.key); setPage(0); }}>
              {t.label} <span>{counts[t.key] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Phones */}
      <ul className="m-cards sm:hidden">
        {visible.map((r) => (
          <li key={r.id} className="m-card">
            <Link href={`/admin/billing/${r.id}`} className="block">
              <div className="m-card-row">
                <p className="m-card-title">{r.organization}</p>
                <p className="m-card-num">{inr(r.status === 'collected' || r.status === 'nil' ? r.expected : r.due)}</p>
              </div>
              <div className="m-card-row mt-2">
                <span className={`ui-pill is-${STATUS[r.status].tone}`}><span className="ui-pill-dot" />{STATUS[r.status].label}</span>
                <span className="m-card-meta">{r.month} · {r.number}</span>
              </div>
            </Link>
          </li>
        ))}
        {visible.length === 0 && <li className="py-12 text-center text-sm text-[var(--muted)]">No statements match</li>}
      </ul>

      <div className="overflow-x-auto hidden sm:block">
        <table className="w-full text-sm tx-table">
          <thead>
            <tr>
              <th className="text-left">Statement</th>
              <th className="text-left">Organization</th>
              <th className="text-left">Month</th>
              <th className="text-right">Coins</th>
              <th className="text-right">Expected</th>
              <th className="text-right">To collect</th>
              <th className="text-left">Status</th>
              <th className="text-left">Collect by</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/admin/billing/${r.id}`} className="font-semibold text-[var(--accent-ink)] hover:underline">{r.number}</Link></td>
                <td className="font-medium text-[var(--fg)]">{r.organization}</td>
                <td className="text-[var(--muted)] whitespace-nowrap">{r.month}</td>
                <td className="text-right">{r.coins.toLocaleString('en-IN')}</td>
                <td className="text-right font-semibold text-[var(--fg)]">{inr(r.expected)}</td>
                <td className="text-right" style={{ color: r.due > 0 ? (r.status === 'overdue' ? 'var(--danger)' : 'var(--warning)') : 'var(--subtle)' }}>{r.due > 0 ? inr(r.due) : '—'}</td>
                <td><span className={`ui-pill is-${STATUS[r.status].tone}`}><span className="ui-pill-dot" />{STATUS[r.status].label}</span></td>
                <td className="text-[var(--muted)] whitespace-nowrap">{r.due > 0 ? r.collectBy || '—' : '—'}</td>
              </tr>
            ))}
            {visible.length === 0 && <tr><td colSpan={8} className="py-14 text-center text-[var(--muted)]">No statements match</td></tr>}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-[var(--line)] text-sm text-[var(--muted)]">
          <span>Page {page + 1} of {pages}</span>
          <span className="flex gap-2">
            <button type="button" className="tx-btn is-icon" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} aria-label="Previous page"><ChevronLeft className="w-4 h-4" /></button>
            <button type="button" className="tx-btn is-icon" onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1} aria-label="Next page"><ChevronRight className="w-4 h-4" /></button>
          </span>
        </div>
      )}
    </section>
  );
}
