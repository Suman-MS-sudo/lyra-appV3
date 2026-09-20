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
}

const CARD: React.CSSProperties = {
  border: '1px solid #e5e5e7',
  borderRadius: 20,
};

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="w-3 h-3 ml-1 inline opacity-30" />;
  return sortDir === 'asc'
    ? <ChevronUp className="w-3 h-3 ml-1 inline" style={{ color: '#0071e3' }} />
    : <ChevronDown className="w-3 h-3 ml-1 inline" style={{ color: '#0071e3' }} />;
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

  const thClass = "py-2.5 px-4 text-xs font-semibold uppercase tracking-wide select-none cursor-pointer transition-colors hover:text-[#1d1d1f]";
  const thStyle = { color: '#86868b' };

  return (
    <div className="rounded-2xl overflow-hidden" style={CARD}>
      <div className="px-5 py-4" style={{ borderBottom: '1px solid #f5f5f7' }}>
        <h2 className="font-semibold text-[#1d1d1f] flex items-center gap-2">
          <Building2 className="w-4 h-4" style={{ color: '#0071e3' }} />
          All Machines
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid #f5f5f7' }}>
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
                style={{ borderBottom: '1px solid #f5f5f7' }}
              >
                <td className="py-3.5 px-4">
                  <button
                    onClick={() => setDetailMachineId(machine.id)}
                    className="font-medium hover:underline"
                    style={{ color: '#0071e3' }}
                  >
                    {machine.name}
                  </button>
                </td>
                <td className="py-3.5 px-4 hidden sm:table-cell" style={{ color: '#6e6e73' }}>
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
                        ? { background: 'rgba(29,122,60,0.12)', color: '#1d7a3c' }
                        : { background: '#f5f5f7', color: '#6e6e73' }
                      }
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${machine.asset_online ? 'animate-pulse bg-emerald-400' : 'bg-gray-500'}`} />
                      {machine.asset_online ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </td>
                <td
                  className="py-3.5 px-4 text-right font-medium"
                  style={{ color: machine.stock_level !== null && machine.stock_level < 5 ? '#9a6400' : '#1d1d1f' }}
                >
                  {machine.stock_level !== null ? `${machine.stock_level} units` : 'N/A'}
                </td>
                {isSuperCustomer && (
                  <>
                    <td className="py-3.5 px-4 text-right hidden md:table-cell">
                      <div className="font-semibold text-[#1d1d1f]">{machine.totalTransactions}</div>
                      <div className="text-xs mt-0.5">
                        <span style={{ color: '#6e6e73' }}>{machine.onlineTransactions}</span>
                        <span style={{ color: '#86868b' }}> / </span>
                        <span style={{ color: '#9a6400' }}>{machine.coinTransactions}</span>
                        <span style={{ color: '#86868b' }}> / </span>
                        <span style={{ color: '#6e6e73' }}>{machine.rfidTransactions}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-[#1d1d1f]">
                      ₹{formatAmount(machine.totalRevenue)}
                    </td>
                  </>
                )}
              </tr>
            )) : (
              <tr>
                <td colSpan={isSuperCustomer ? 6 : 4} className="py-16 text-center">
                  <Building2 className="w-10 h-10 mx-auto mb-3" style={{ color: '#e5e5e7' }} />
                  <p className="font-medium" style={{ color: '#6e6e73' }}>No machines found</p>
                  <p className="text-xs mt-1" style={{ color: '#a1a1a6' }}>Contact admin to add machines to your account</p>
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
