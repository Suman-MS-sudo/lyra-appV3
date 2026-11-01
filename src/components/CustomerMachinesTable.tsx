'use client';

import { useState } from 'react';
import { MapPin, Building2, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import MachineDetailModal from './MachineDetailModal';

type SortKey = 'name' | 'location' | 'asset_online' | 'stock_level' | 'totalTransactions' | 'totalRevenue';
type SortDir = 'asc' | 'desc';

interface Machine {
  id: string;
  name: string;
  location: string;
  asset_online: boolean;
  stock_level: number | null;
  totalTransactions: number;
  onlineTransactions: number;
  coinTransactions: number;
  rfidTransactions: number;
  totalRevenue: number;
  /** Team member this machine is assigned to (super customers only) */
  assignee?: string | null;
}

const CARD: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 20,
  boxShadow: 'var(--shadow-card)',
};

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="w-3 h-3 ml-1 inline opacity-30" />;
  return sortDir === 'asc'
    ? <ChevronUp className="w-3 h-3 ml-1 inline" style={{ color: 'var(--accent-ink)' }} />
    : <ChevronDown className="w-3 h-3 ml-1 inline" style={{ color: 'var(--accent-ink)' }} />;
}

export function CustomerMachinesTable({
  machines,
  isSuperCustomer,
}: {
  machines: Machine[];
  isSuperCustomer: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [detailMachineId, setDetailMachineId] = useState<string | null>(null);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'asset_online' ? 'desc' : 'asc');
    }
  }

  const sorted = [...machines].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'asset_online') {
      cmp = (a.asset_online === b.asset_online) ? 0 : a.asset_online ? -1 : 1;
    } else if (sortKey === 'stock_level') {
      const av = a.stock_level ?? -1;
      const bv = b.stock_level ?? -1;
      cmp = av - bv;
    } else if (sortKey === 'totalTransactions') {
      cmp = a.totalTransactions - b.totalTransactions;
    } else if (sortKey === 'totalRevenue') {
      cmp = a.totalRevenue - b.totalRevenue;
    } else if (sortKey === 'name') {
      cmp = a.name.localeCompare(b.name);
    } else if (sortKey === 'location') {
      cmp = a.location.localeCompare(b.location);
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const formatAmount = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const thClass = "py-2.5 px-4 text-xs font-semibold uppercase tracking-wide select-none cursor-pointer transition-colors hover:text-[var(--fg)]";
  const thStyle = { color: 'var(--subtle)' };

  return (
    <div className="rounded-2xl overflow-hidden" style={CARD}>
      <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--surface-2)' }}>
        <h2 className="font-semibold text-[var(--fg)] flex items-center gap-2">
          <Building2 className="w-4 h-4" style={{ color: 'var(--accent-ink)' }} />
          All Machines
        </h2>
      </div>
      {/* Phones: one card per machine */}
      <ul className="m-cards sm:hidden">
        {sorted.map((machine) => {
          const low = machine.stock_level !== null && machine.stock_level < 5;
          return (
            <li key={`m-${machine.id}`} className="m-card">
              <div className="m-card-row">
                <button type="button" onClick={() => setDetailMachineId(machine.id)} className="m-card-title text-left hover:underline" style={{ color: 'var(--accent-ink)' }}>
                  {machine.name}
                </button>
                <span className={`ui-pill ${machine.asset_online ? 'is-ok' : 'is-muted'}`}><span className="ui-pill-dot" />{machine.asset_online ? 'Online' : 'Offline'}</span>
              </div>
              <div className="m-card-row mt-2">
                <span className="m-card-meta truncate">{machine.assignee ? `Assigned to ${machine.assignee}` : machine.location}</span>
                <span className="flex items-center gap-3 shrink-0 text-sm">
                  <span style={{ color: low ? 'var(--warning)' : 'var(--fg)' }} className="font-semibold">{machine.stock_level !== null ? `${machine.stock_level} left` : '—'}</span>
                  {isSuperCustomer && <span className="font-bold text-[var(--fg)]">₹{formatAmount(machine.totalRevenue)}</span>}
                </span>
              </div>
            </li>
          );
        })}
        {sorted.length === 0 && <li className="py-12 text-center text-sm text-[var(--muted)]">No machines found</li>}
      </ul>

      <div className="overflow-x-auto hidden sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--surface-2)' }}>
              <th className={`${thClass} text-left`} style={thStyle} onClick={() => handleSort('name')}>
                Machine <SortIcon col="name" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th className={`${thClass} text-left hidden sm:table-cell`} style={thStyle} onClick={() => handleSort('location')}>
                Location <SortIcon col="location" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th className={`${thClass} text-center`} style={thStyle} onClick={() => handleSort('asset_online')}>
                Status <SortIcon col="asset_online" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th className={`${thClass} text-right`} style={thStyle} onClick={() => handleSort('stock_level')}>
                Stock <SortIcon col="stock_level" sortKey={sortKey} sortDir={sortDir} />
              </th>
              {isSuperCustomer && (
                <>
                  <th className={`${thClass} text-right hidden md:table-cell`} style={thStyle} onClick={() => handleSort('totalTransactions')}>
                    Transactions <SortIcon col="totalTransactions" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th className={`${thClass} text-right`} style={thStyle} onClick={() => handleSort('totalRevenue')}>
                    Revenue <SortIcon col="totalRevenue" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.length > 0 ? sorted.map((machine) => (
              <tr
                key={machine.id}
                className="row-hover"
                style={{ borderBottom: '1px solid var(--surface-2)' }}
              >
                <td className="py-3.5 px-4">
                  <button
                    onClick={() => setDetailMachineId(machine.id)}
                    className="font-medium hover:underline"
                    style={{ color: 'var(--accent-ink)' }}
                  >
                    {machine.name}
                  </button>
                  {machine.assignee && (
                    <p className="text-xs mt-0.5 text-[var(--muted)]">Assigned to {machine.assignee}</p>
                  )}
                </td>
                <td className="py-3.5 px-4 hidden sm:table-cell" style={{ color: 'var(--muted)' }}>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3 h-3" />
                    {machine.location}
                  </div>
                </td>
                <td className="py-3.5 px-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={machine.asset_online
                        ? { background: 'rgba(29,122,60,0.12)', color: 'var(--success)' }
                        : { background: 'var(--surface-2)', color: 'var(--muted)' }
                      }
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${machine.asset_online ? 'animate-pulse bg-emerald-400' : 'bg-gray-500'}`} />
                      {machine.asset_online ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </td>
                <td
                  className="py-3.5 px-4 text-right font-medium"
                  style={{ color: machine.stock_level !== null && machine.stock_level < 5 ? 'var(--warning)' : 'var(--fg)' }}
                >
                  {machine.stock_level !== null ? `${machine.stock_level} units` : 'N/A'}
                </td>
                {isSuperCustomer && (
                  <>
                    <td className="py-3.5 px-4 text-right hidden md:table-cell">
                      <div className="font-semibold text-[var(--fg)]">{machine.totalTransactions}</div>
                      <div className="text-xs mt-0.5">
                        <span style={{ color: 'var(--muted)' }}>{machine.onlineTransactions}</span>
                        <span style={{ color: 'var(--subtle)' }}> / </span>
                        <span style={{ color: 'var(--warning)' }}>{machine.coinTransactions}</span>
                        <span style={{ color: 'var(--subtle)' }}> / </span>
                        <span style={{ color: 'var(--muted)' }}>{machine.rfidTransactions}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-[var(--fg)]">
                      ₹{formatAmount(machine.totalRevenue)}
                    </td>
                  </>
                )}
              </tr>
            )) : (
              <tr>
                <td colSpan={isSuperCustomer ? 6 : 4} className="py-16 text-center">
                  <Building2 className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--line)' }} />
                  <p className="font-medium" style={{ color: 'var(--muted)' }}>No machines found</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--subtle)' }}>Contact admin to add machines to your account</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {detailMachineId && (
        <MachineDetailModal machineId={detailMachineId} onClose={() => setDetailMachineId(null)} />
      )}
    </div>
  );
}
