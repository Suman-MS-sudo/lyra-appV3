'use client';

import { useState } from 'react';
import { CheckCircle2, FileText, Loader2, X } from 'lucide-react';
import { generateMonthlyInvoices } from '@/app/actions/organization-billing';

type Result = Awaited<ReturnType<typeof generateMonthlyInvoices>>;

/** Month label for an offset from the current IST month. */
function monthLabel(offset: number) {
  const ist = new Date(Date.now() + 5.5 * 3600_000);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() + offset, 1))
    .toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** Run monthly billing on demand (the same job the 1st-of-month automation runs). */
export function GenerateMonthlyInvoicesButton() {
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!confirm(`Create ${monthLabel(offset)} invoices for every organization not yet invoiced, and email the ones with an amount due?`)) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await generateMonthlyInvoices(offset));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Billing run failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="lyra-chamfer inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold">
        <FileText className="w-4 h-4" /> Run billing
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Run monthly billing">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !loading && setOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl p-6 bg-[var(--surface)] border border-[var(--line)] shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[var(--fg)]">Run monthly billing</h2>
                <p className="text-sm mt-1 text-[var(--muted)]">Runs automatically at 00:00 IST on the 1st. Organizations already invoiced for the month are skipped.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} disabled={loading} className="adm-iconbtn" aria-label="Close"><X className="w-4 h-4" /></button>
            </div>

            <label className="block mt-5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]" htmlFor="bill-month">Billing month</label>
            <select id="bill-month" value={offset} onChange={(e) => setOffset(Number(e.target.value))} disabled={loading} className="mt-2 w-full px-3 py-2.5 text-sm rounded-xl border border-[var(--line-strong)]">
              {Array.from({ length: 12 }, (_, i) => -(i + 1)).map((o) => (
                <option key={o} value={o}>{monthLabel(o)}{o === -1 ? ' (last month)' : ''}</option>
              ))}
            </select>

            {error && <p role="alert" className="mt-4 p-3 rounded-xl text-sm bg-[var(--danger-bg)] text-[var(--danger)]">{error}</p>}

            {result && (
              <div className="mt-4 p-4 rounded-xl bg-[var(--surface-2)] text-sm" role="status">
                <p className="flex items-center gap-2 font-semibold text-[var(--fg)]"><CheckCircle2 className="w-4 h-4 text-[var(--success)]" />{result.period?.label} billing done</p>
                <div className="grid grid-cols-2 gap-2 mt-3 text-[var(--fg-2)]">
                  <span>Created: <b>{result.created}</b></span>
                  <span>Already invoiced: <b>{result.skipped}</b></span>
                  <span>Emails sent: <b>{result.emailsSent}</b></span>
                  <span className={result.failed ? 'text-[var(--danger)]' : ''}>Failed: <b>{result.failed}</b></span>
                </div>
                {result.details.some((d) => d.error) && (
                  <ul className="mt-3 space-y-1 text-xs text-[var(--danger)]">
                    {result.details.filter((d) => d.error).map((d) => <li key={d.organization}>{d.organization}: {d.error}</li>)}
                  </ul>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={() => setOpen(false)} disabled={loading} className="px-4 py-2 text-sm font-semibold rounded-xl text-[var(--muted)] hover:text-[var(--fg)]">Close</button>
              <button type="button" onClick={run} disabled={loading} className="lyra-chamfer inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-[var(--accent)] text-white disabled:opacity-60">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Running…</> : `Bill ${monthLabel(offset)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
