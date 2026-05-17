'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { FileText, Coins, TrendingUp, TrendingDown, Clock, CheckCircle, AlertCircle, Building2, ChevronDown, ChevronUp } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────
interface Organization {
  id: string;
  name: string;
  contact_email: string;
}

interface Invoice {
  id: string;
  organization_id: string;
  status: string;
  amount_due_paisa: number;
  total_amount_paisa: number;
  created_at: string;
  period_start?: string;
  period_end?: string;
  organizations?: Organization | null;
}

interface OrgSummary {
  organization: Organization | null;
  invoices: Invoice[];
  totalCollected: number;
  totalPending: number;
  totalOverdue: number;
  oldestUnpaidDueDate: Date | null;
}

interface OrgCoinData extends Organization {
  thisMonthTotal: number;
  thisMonthCount: number;
  lastMonthTotal: number;
  lastMonthCount: number;
  machineCount: number;
}

interface Props {
  organizationSummaries: OrgSummary[];
  orgCoinData: OrgCoinData[];
  invoices: Invoice[] | null;
  CARD: React.CSSProperties;
  totalPaid: number;
  totalPending: number;
  totalOverdue: number;
  totalThisMonthCoin: number;
  totalLastMonthCoin: number;
}

// ── Helpers ────────────────────────────────────────────────
const fmt = (paisa: number) =>
  (paisa / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const style =
    s === 'paid'    ? { background: 'rgba(52,211,153,0.15)',  color: '#6EE7B7' } :
    s === 'pending' ? { background: 'rgba(251,191,36,0.15)',  color: '#FDE68A' } :
    s === 'overdue' ? { background: 'rgba(239,68,68,0.15)',   color: '#FCA5A5' } :
                      { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.45)' };
  const Icon = s === 'paid' ? CheckCircle : s === 'pending' ? Clock : AlertCircle;
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold capitalize" style={style}>
      <Icon className="w-3 h-3" />
      {status}
    </span>
  );
}

// ── Component ──────────────────────────────────────────────
export function BillingTablesClient({
  organizationSummaries,
  orgCoinData,
  invoices,
  CARD,
  totalPaid,
  totalPending,
  totalOverdue,
  totalThisMonthCoin,
  totalLastMonthCoin,
}: Props) {
  const [invoiceLimit, setInvoiceLimit] = useState(10);

  const coinTrend = totalLastMonthCoin > 0
    ? ((totalThisMonthCoin - totalLastMonthCoin) / totalLastMonthCoin) * 100
    : null;

  const thStyle: React.CSSProperties = { color: 'rgba(255,255,255,0.35)' };
  const thClass = 'py-3 px-4 text-xs font-semibold uppercase tracking-wide text-left';

  return (
    <div className="space-y-8">

      {/* ── Stats cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Collected',  value: `₹${fmt(totalPaid)}`,           icon: CheckCircle,  iconColor: '#34D399', iconBg: 'rgba(52,211,153,0.18)'  },
          { label: 'Pending',          value: `₹${fmt(totalPending)}`,         icon: Clock,        iconColor: '#FBBF24', iconBg: 'rgba(251,191,36,0.18)'  },
          { label: 'Overdue',          value: `₹${fmt(totalOverdue)}`,         icon: AlertCircle,  iconColor: '#EF4444', iconBg: 'rgba(239,68,68,0.18)'   },
          { label: 'Coin — This Month',value: `₹${fmt(totalThisMonthCoin)}`,   icon: Coins,        iconColor: '#A78BFA', iconBg: 'rgba(167,139,250,0.18)' },
        ].map(({ label, value, icon: Icon, iconColor, iconBg }) => (
          <div key={label} className="rounded-2xl p-5 relative overflow-hidden" style={CARD}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: iconBg }}>
              <Icon className="w-5 h-5" style={{ color: iconColor }} />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'rgba(255,255,255,0.40)' }}>{label}</p>
            <p className="text-xl font-bold text-white leading-tight">{value}</p>
            {label === 'Coin — This Month' && coinTrend !== null && (
              <p className="text-xs mt-1 flex items-center gap-0.5" style={{ color: coinTrend >= 0 ? '#34D399' : '#FCA5A5' }}>
                {coinTrend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(coinTrend).toFixed(1)}% vs last month
              </p>
            )}
          </div>
        ))}
      </div>

      {/* ── Organization summaries ── */}
      <div className="rounded-2xl overflow-hidden" style={CARD}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Building2 className="w-4 h-4" style={{ color: '#60A5FA' }} />
            Organization Billing Summary
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>Invoice totals per organization</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <th className={thClass} style={thStyle}>Organization</th>
                <th className={`${thClass} text-right`} style={thStyle}>Collected</th>
                <th className={`${thClass} text-right hidden sm:table-cell`} style={thStyle}>Pending</th>
                <th className={`${thClass} text-right hidden sm:table-cell`} style={thStyle}>Overdue</th>
                <th className={`${thClass} text-right`} style={thStyle}>Invoices</th>
              </tr>
            </thead>
            <tbody>
              {organizationSummaries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-sm" style={{ color: 'rgba(255,255,255,0.30)' }}>
                    No billing data yet
                  </td>
                </tr>
              ) : organizationSummaries.map((s, i) => (
                <tr key={i} className="row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td className="py-3.5 px-4">
                    <p className="font-semibold text-white">{s.organization?.name ?? '—'}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.organization?.contact_email}</p>
                  </td>
                  <td className="py-3.5 px-4 text-right font-semibold" style={{ color: '#6EE7B7' }}>
                    ₹{fmt(s.totalCollected)}
                  </td>
                  <td className="py-3.5 px-4 text-right hidden sm:table-cell font-medium" style={{ color: s.totalPending > 0 ? '#FDE68A' : 'rgba(255,255,255,0.30)' }}>
                    {s.totalPending > 0 ? `₹${fmt(s.totalPending)}` : '—'}
                  </td>
                  <td className="py-3.5 px-4 text-right hidden sm:table-cell font-medium" style={{ color: s.totalOverdue > 0 ? '#FCA5A5' : 'rgba(255,255,255,0.30)' }}>
                    {s.totalOverdue > 0 ? `₹${fmt(s.totalOverdue)}` : '—'}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <span className="text-sm font-medium text-white">{s.invoices.length}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Coin revenue by org ── */}
      {orgCoinData.some(o => o.thisMonthTotal > 0 || o.lastMonthTotal > 0) && (
        <div className="rounded-2xl overflow-hidden" style={CARD}>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Coins className="w-4 h-4" style={{ color: '#A78BFA' }} />
              Coin Revenue by Organization
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>Dispensed coin payments this vs last month</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <th className={thClass} style={thStyle}>Organization</th>
                  <th className={`${thClass} text-right`} style={thStyle}>This Month</th>
                  <th className={`${thClass} text-right hidden sm:table-cell`} style={thStyle}>Last Month</th>
                  <th className={`${thClass} text-right hidden md:table-cell`} style={thStyle}>Machines</th>
                  <th className={`${thClass} text-right hidden md:table-cell`} style={thStyle}>Trend</th>
                </tr>
              </thead>
              <tbody>
                {orgCoinData.map(org => {
                  const trend = org.lastMonthTotal > 0
                    ? ((org.thisMonthTotal - org.lastMonthTotal) / org.lastMonthTotal) * 100
                    : null;
                  return (
                    <tr key={org.id} className="row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-white">{org.name}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{org.contact_email}</p>
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold" style={{ color: '#A78BFA' }}>
                        ₹{fmt(org.thisMonthTotal)}
                        <span className="block text-xs font-normal" style={{ color: 'rgba(255,255,255,0.35)' }}>{org.thisMonthCount} txns</span>
                      </td>
                      <td className="py-3.5 px-4 text-right hidden sm:table-cell" style={{ color: 'rgba(255,255,255,0.55)' }}>
                        ₹{fmt(org.lastMonthTotal)}
                        <span className="block text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{org.lastMonthCount} txns</span>
                      </td>
                      <td className="py-3.5 px-4 text-right hidden md:table-cell font-medium text-white">
                        {org.machineCount}
                      </td>
                      <td className="py-3.5 px-4 text-right hidden md:table-cell">
                        {trend !== null ? (
                          <span className="inline-flex items-center gap-0.5 text-xs font-semibold" style={{ color: trend >= 0 ? '#34D399' : '#FCA5A5' }}>
                            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {Math.abs(trend).toFixed(1)}%
                          </span>
                        ) : (
                          <span style={{ color: 'rgba(255,255,255,0.25)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── All invoices ── */}
      <div className="rounded-2xl overflow-hidden" style={CARD}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 className="font-semibold text-white flex items-center gap-2">
            <FileText className="w-4 h-4" style={{ color: '#F472B6' }} />
            All Invoices
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>{invoices?.length ?? 0} invoices total</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <th className={thClass} style={thStyle}>Organization</th>
                <th className={`${thClass} hidden md:table-cell`} style={thStyle}>Period</th>
                <th className={`${thClass} text-right`} style={thStyle}>Amount</th>
                <th className={`${thClass} text-center`} style={thStyle}>Status</th>
                <th className={`${thClass} text-right`} style={thStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {(invoices ?? []).slice(0, invoiceLimit).map(inv => (
                <tr key={inv.id} className="row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td className="py-3.5 px-4">
                    <p className="font-semibold text-white">{inv.organizations?.name ?? '—'}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {new Date(inv.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </td>
                  <td className="py-3.5 px-4 text-xs hidden md:table-cell" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    {inv.period_start && inv.period_end
                      ? `${new Date(inv.period_start).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`
                      : '—'}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <p className="font-semibold text-white">₹{fmt(inv.total_amount_paisa)}</p>
                    {inv.amount_due_paisa > 0 && inv.status !== 'paid' && (
                      <p className="text-xs mt-0.5" style={{ color: '#FDE68A' }}>Due ₹{fmt(inv.amount_due_paisa)}</p>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <Link
                      href={`/admin/billing/${inv.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                      style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.22)', color: '#F472B6' }}
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Show more / less */}
        {(invoices?.length ?? 0) > 10 && (
          <div className="px-5 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              onClick={() => setInvoiceLimit(l => l === 10 ? (invoices?.length ?? 10) : 10)}
              className="flex items-center gap-1.5 text-xs font-semibold mx-auto transition-colors"
              style={{ color: '#F472B6' }}
            >
              {invoiceLimit === 10 ? (
                <><ChevronDown className="w-3.5 h-3.5" />Show all {invoices?.length} invoices</>
              ) : (
                <><ChevronUp className="w-3.5 h-3.5" />Show less</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
