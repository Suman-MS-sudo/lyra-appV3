'use client';

import { useState, useTransition } from 'react';
import { recordManualRecharge, setDepositStatus, setRentalStatus, startRental, type ActionResult } from '@/app/actions/rentals';
import { RENTAL_STATE_UI, fmtDate, type RentalState } from '@/lib/rental-state';

export type AdminRental = {
  id: string;
  rental_code: string;
  booking_ref: string;
  plan_id: string;
  capacity: number;
  monthly_rent: number;
  model_name: string;
  machine_id: string | null;
  machine_label: string | null;
  start_date: string | null;
  paid_until: string | null;
  prepaid_months: number;
  deposit_amount: number;
  deposit_status: 'none' | 'held' | 'refunded' | 'adjusted';
  status: 'open' | 'ended' | 'cancelled';
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  organisation: string | null;
  site_address: string | null;
  created_at: string;
  state: RentalState;
  total_paid: number;
  last_payment: { kind: string; months: number; total_amount: number; paid_at: string | null; source: string } | null;
};

const inr = (n: number) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);

export function AdminRentalsClient({ rows, machines }: { rows: AdminRental[]; machines: { id: string; label: string }[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const q = filter.trim().toLowerCase();
  const shown = q
    ? rows.filter((r) => [r.rental_code, r.customer_name, r.organisation, r.customer_phone, r.machine_label].some((v) => v?.toLowerCase().includes(q)))
    : rows;

  return (
    <div className="mt-8">
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Search code, customer, phone or machine…"
        className="w-full sm:w-96 rounded-xl border border-[#e5e5e7] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#1d1d1f]"
      />
      {shown.length === 0 ? (
        <p className="mt-10 text-center text-sm text-[#6e6e73]">No rentals yet. They appear here when a customer books on the website.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {shown.map((r) => (
            <RentalRow key={r.id} r={r} machines={machines} expanded={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function RentalRow({ r, machines, expanded, onToggle }: { r: AdminRental; machines: { id: string; label: string }[]; expanded: boolean; onToggle: () => void }) {
  const ui = RENTAL_STATE_UI[r.state];
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string>('');
  const run = (fn: () => Promise<ActionResult>, okMsg: string) =>
    start(async () => {
      const res = await fn();
      setMsg(res.ok ? okMsg : `Error: ${res.error}`);
    });

  return (
    <div className="rounded-2xl border border-[#e5e5e7] bg-white">
      <button type="button" onClick={onToggle} className="w-full text-left p-4 flex flex-wrap items-center gap-x-6 gap-y-2">
        <span className="font-mono text-sm font-semibold text-[#1d1d1f] min-w-[13rem]">{r.rental_code}</span>
        <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: ui.bg, color: ui.fg }}>
          {ui.label}
        </span>
        <span className="text-sm text-[#1d1d1f] flex-1 min-w-[12rem]">
          {r.organisation || r.customer_name}
          <span className="block text-xs text-[#6e6e73]">
            {r.model_name} · {r.capacity} napkins · {inr(r.monthly_rent)}/mo
          </span>
        </span>
        <span className="text-xs text-[#6e6e73]">
          {r.start_date ? (
            <>
              Paid until <strong className="text-[#1d1d1f]">{fmtDate(r.paid_until)}</strong>
            </>
          ) : (
            <>
              Prepaid <strong className="text-[#1d1d1f]">{r.prepaid_months} mo</strong>
            </>
          )}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-[#f0f0f2] p-4 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <dl className="grid grid-cols-[8rem_1fr] gap-y-1.5 text-sm">
            <dt className="text-[#6e6e73]">Customer</dt>
            <dd>{r.customer_name}</dd>
            <dt className="text-[#6e6e73]">Phone</dt>
            <dd>
              <a className="text-[#0066cc]" href={`tel:+91${r.customer_phone}`}>
                +91 {r.customer_phone}
              </a>
            </dd>
            <dt className="text-[#6e6e73]">Email</dt>
            <dd className="break-all">{r.customer_email}</dd>
            <dt className="text-[#6e6e73]">Site</dt>
            <dd>{r.site_address || '—'}</dd>
            <dt className="text-[#6e6e73]">Machine</dt>
            <dd>{r.machine_label || 'Not linked yet'}</dd>
            <dt className="text-[#6e6e73]">Started</dt>
            <dd>{fmtDate(r.start_date)}</dd>
            <dt className="text-[#6e6e73]">Deposit</dt>
            <dd>
              {r.deposit_amount > 0 ? `${inr(r.deposit_amount)} · ${r.deposit_status}` : 'None (advance option)'}
            </dd>
            <dt className="text-[#6e6e73]">Total paid</dt>
            <dd>{inr(r.total_paid)}</dd>
            <dt className="text-[#6e6e73]">Last payment</dt>
            <dd>
              {r.last_payment
                ? `${r.last_payment.kind} · ${r.last_payment.months} mo · ${inr(r.last_payment.total_amount)} · ${r.last_payment.paid_at?.slice(0, 10) ?? ''} (${r.last_payment.source})`
                : '—'}
            </dd>
            <dt className="text-[#6e6e73]">Booked</dt>
            <dd>{r.created_at.slice(0, 10)} · {r.booking_ref}</dd>
          </dl>

          <div className="space-y-5">
            {r.state === 'pending_install' && (
              <form
                className="rounded-xl bg-[#f5f5f7] p-4 space-y-3"
                action={(fd) => run(() => startRental(r.id, String(fd.get('machine') ?? ''), String(fd.get('date') ?? '')), 'Rental started.')}
              >
                <p className="text-sm font-semibold text-[#1d1d1f]">Start rental (at installation)</p>
                <select name="machine" required defaultValue="" className="w-full rounded-lg border border-[#e5e5e7] bg-white px-3 py-2 text-sm">
                  <option value="" disabled>
                    Installed machine…
                  </option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <input type="date" name="date" required defaultValue={today()} className="w-full rounded-lg border border-[#e5e5e7] bg-white px-3 py-2 text-sm" />
                <p className="text-xs text-[#6e6e73]">
                  The {r.prepaid_months} prepaid month{r.prepaid_months === 1 ? '' : 's'} start from this date.
                </p>
                <button disabled={pending} className="rounded-lg bg-[#1d1d1f] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                  Start rental
                </button>
              </form>
            )}

            {r.status === 'open' && (
              <form
                className="rounded-xl border border-[#e5e5e7] p-4 space-y-3"
                action={(fd) =>
                  run(
                    () => recordManualRecharge(r.id, Number(fd.get('months')), Number(fd.get('amount')), String(fd.get('ref') ?? '')),
                    'Payment recorded.'
                  )
                }
              >
                <p className="text-sm font-semibold text-[#1d1d1f]">Record offline payment (cash / cheque / bank)</p>
                <div className="grid grid-cols-3 gap-2">
                  <input name="months" type="number" min={1} max={36} defaultValue={1} required className="rounded-lg border border-[#e5e5e7] px-3 py-2 text-sm" aria-label="Months" />
                  <input name="amount" type="number" min={0} step="0.01" placeholder="Amount ₹" required className="rounded-lg border border-[#e5e5e7] px-3 py-2 text-sm" aria-label="Amount received" />
                  <input name="ref" placeholder="Reference" className="rounded-lg border border-[#e5e5e7] px-3 py-2 text-sm" aria-label="Reference" />
                </div>
                <button disabled={pending} className="rounded-lg border border-[#1d1d1f] px-4 py-2 text-sm font-medium text-[#1d1d1f] disabled:opacity-50">
                  Add months
                </button>
              </form>
            )}

            <div className="flex flex-wrap gap-2">
              {r.deposit_amount > 0 && r.deposit_status === 'held' && (
                <button
                  disabled={pending}
                  onClick={() => run(() => setDepositStatus(r.id, 'refunded'), 'Deposit marked refunded.')}
                  className="rounded-lg border border-[#e5e5e7] px-3 py-2 text-xs font-medium"
                >
                  Mark deposit refunded
                </button>
              )}
              {r.status === 'open' ? (
                <button
                  disabled={pending}
                  onClick={() => confirm(`End rental ${r.rental_code}? The machine will no longer be locked for unpaid rent.`) && run(() => setRentalStatus(r.id, 'ended'), 'Rental ended.')}
                  className="rounded-lg border border-[#e5e5e7] px-3 py-2 text-xs font-medium text-[#c8102e]"
                >
                  End rental
                </button>
              ) : (
                <button disabled={pending} onClick={() => run(() => setRentalStatus(r.id, 'open'), 'Rental reopened.')} className="rounded-lg border border-[#e5e5e7] px-3 py-2 text-xs font-medium">
                  Reopen
                </button>
              )}
            </div>
            {msg && <p className={`text-sm ${msg.startsWith('Error') ? 'text-[#c8102e]' : 'text-[#137333]'}`}>{msg}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
