'use client';

import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  Search, Filter, Download, MapPin, AlertCircle,
  CheckCircle, Clock, Edit2, Trash2, ChevronUp, ChevronDown,
  ChevronsUpDown, Building2,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

interface Machine {
  id: string;
  name: string;
  machine_id: string;
  mac_id: string;
  location: string;
  status: string;
  customer_name: string;
  product_type: string;
  machine_type: string;
  last_sync: string | null;
  last_ping: string | null;
  asset_online: boolean;
  stock_level: number | null;
  created_at: string;
  body_type?: string;
  max_capacity?: number;
  motor_stock?: number[] | null;
}

// ── Helpers ────────────────────────────────────────────────
function formatDate(dateString: string) {
  const d = new Date(dateString);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60)     return 'Just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toISOString().split('T')[0];
}

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ChevronsUpDown className="w-3 h-3 ml-1 inline opacity-25" />;
  return dir === 'asc'
    ? <ChevronUp   className="w-3 h-3 ml-1 inline" style={{ color: '#F472B6' }} />
    : <ChevronDown className="w-3 h-3 ml-1 inline" style={{ color: '#F472B6' }} />;
}

const CARD: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 20,
};

const INPUT_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: 'white',
  borderRadius: 12,
  outline: 'none',
};

const SELECT_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: 'rgba(255,255,255,0.80)',
  borderRadius: 10,
  outline: 'none',
};

// ── Component ──────────────────────────────────────────────
export default function MachinesTable({ machines }: { machines: Machine[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Seeded from the URL (?q=...) so the search term survives navigating away
  // (e.g. clicking Edit) and back — this component remounts fresh on every
  // visit to /admin/machines, so local-only state would otherwise reset.
  const [searchQuery, setSearchQuery]     = useState(searchParams.get('q') || '');
  const [statusFilter, setStatusFilter]   = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [onlineFilter, setOnlineFilter]   = useState('all');
  const [currentPage, setCurrentPage]     = useState(1);
  const [itemsPerPage, setItemsPerPage]   = useState(25);
  const [showFilters, setShowFilters]     = useState(false);
  const [deletingId, setDeletingId]       = useState<string | null>(null);
  const [sortBy, setSortBy]               = useState<keyof Machine>('name');
  const [sortDir, setSortDir]             = useState<'asc' | 'desc'>('asc');
  // Per-motor stock breakdown tooltip, rendered via portal at fixed viewport
  // coordinates — the table sits inside overflow-x-auto/overflow-hidden
  // wrappers (needed for horizontal scroll + rounded corners), which also
  // clip vertical overflow, so an absolutely-positioned tooltip anchored
  // inside the row got its top edge cut off for rows near the top of the
  // table. A portal escapes that clipping entirely.
  const [motorTooltip, setMotorTooltip] = useState<{ top: number; right: number; above: boolean; stock: number[] } | null>(null);

  const customers = useMemo(() => {
    return Array.from(new Set(machines.map(m => m.customer_name).filter(Boolean))).sort();
  }, [machines]);

  function handleSort(col: keyof Machine) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
    setCurrentPage(1);
  }

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return machines
      .filter(m =>
        (m.name.toLowerCase().includes(q) ||
         m.machine_id.toLowerCase().includes(q) ||
         m.mac_id.toLowerCase().includes(q) ||
         m.location.toLowerCase().includes(q)) &&
        (statusFilter  === 'all' || m.status === statusFilter) &&
        (customerFilter === 'all' || m.customer_name === customerFilter) &&
        (onlineFilter  === 'all' ||
          (onlineFilter === 'online'  && m.asset_online) ||
          (onlineFilter === 'offline' && !m.asset_online))
      )
      .sort((a, b) => {
        let av: any = a[sortBy];
        let bv: any = b[sortBy];
        if (sortBy === 'asset_online') { av = a.asset_online ? 1 : 0; bv = b.asset_online ? 1 : 0; }
        else if (sortBy === 'last_ping') { av = a.last_ping ? new Date(a.last_ping).getTime() : 0; bv = b.last_ping ? new Date(b.last_ping).getTime() : 0; }
        else if (sortBy === 'stock_level') { av = a.stock_level ?? -1; bv = b.stock_level ?? -1; }
        else if (typeof av === 'string') { av = av.toLowerCase(); bv = (bv as string).toLowerCase(); }
        if (av == null) av = ''; if (bv == null) bv = '';
        return av < bv ? (sortDir === 'asc' ? -1 : 1) : av > bv ? (sortDir === 'asc' ? 1 : -1) : 0;
      });
  }, [machines, searchQuery, statusFilter, customerFilter, onlineFilter, sortBy, sortDir]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const start = (currentPage - 1) * itemsPerPage;
  const page = filtered.slice(start, start + itemsPerPage);

  const stats = useMemo(() => ({
    total:    machines.length,
    online:   machines.filter(m => m.asset_online).length,
    offline:  machines.filter(m => !m.asset_online).length,
    lowStock: machines.filter(m => m.stock_level !== null && m.stock_level < 5).length,
  }), [machines]);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch('/api/machines/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machineId: id }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      alert('Failed to delete machine. Please try again.');
    } finally {
      setDeletingId(null);
    }
  }

  function exportToCSV() {
    const headers = ['Name', 'Machine ID', 'MAC ID', 'Location', 'Status', 'Customer', 'Type', 'Motor Type', 'Stock', 'Last Ping'];
    const rows = filtered.map(m => [
      m.name, m.machine_id, m.mac_id, m.location, m.status,
      m.customer_name, m.machine_type, m.body_type === 'quad_motor' ? 'Quad Motor' : 'Single Motor',
      m.stock_level?.toString() ?? '0',
      m.last_ping ? new Date(m.last_ping).toLocaleString() : 'Never',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `machines-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }

  const activeFilters = statusFilter !== 'all' || customerFilter !== 'all' || onlineFilter !== 'all';
  const thStyle: React.CSSProperties = { color: 'rgba(255,255,255,0.35)' };
  const thClass = 'py-3 px-4 text-xs font-semibold uppercase tracking-wide text-left select-none cursor-pointer hover:text-white transition-colors';

  return (
    <div className="space-y-5">

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Machines', value: stats.total,   icon: Building2,     iconColor: '#60A5FA', iconBg: 'rgba(96,165,250,0.18)'  },
          { label: 'Online',         value: stats.online,  icon: CheckCircle,   iconColor: '#34D399', iconBg: 'rgba(52,211,153,0.18)'  },
          { label: 'Offline',        value: stats.offline, icon: Clock,         iconColor: 'rgba(255,255,255,0.50)', iconBg: 'rgba(255,255,255,0.08)' },
          { label: 'Low Stock',      value: stats.lowStock,icon: AlertCircle,   iconColor: '#FBBF24', iconBg: 'rgba(251,191,36,0.18)'  },
        ].map(({ label, value, icon: Icon, iconColor, iconBg }) => (
          <div key={label} className="rounded-2xl p-5 relative overflow-hidden" style={CARD}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: iconBg }}>
              <Icon className="w-5 h-5" style={{ color: iconColor }} />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'rgba(255,255,255,0.40)' }}>{label}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* ── Search & filter bar ── */}
      <div className="rounded-2xl p-4 space-y-3" style={CARD}>
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.35)' }} />
            <input
              type="text"
              placeholder="Search name, machine ID, MAC, location…"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2.5 text-sm"
              style={INPUT_STYLE}
            />
          </div>
          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(f => !f)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={activeFilters
              ? { background: 'rgba(244,63,94,0.18)', border: '1px solid rgba(244,63,94,0.35)', color: '#F472B6' }
              : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.65)' }
            }
          >
            <Filter className="w-4 h-4" />
            Filters{activeFilters && ' •'}
          </button>
          {/* Export */}
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.65)' }}
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            {[
              {
                label: 'Status', value: statusFilter, set: setStatusFilter,
                options: [['all', 'All Status'], ['online', 'Online'], ['offline', 'Offline'], ['maintenance', 'Maintenance']],
              },
              {
                label: 'Customer', value: customerFilter, set: setCustomerFilter,
                options: [['all', 'All Customers'], ...customers.map(c => [c, c])],
              },
              {
                label: 'Connection', value: onlineFilter, set: setOnlineFilter,
                options: [['all', 'All'], ['online', 'Connected'], ['offline', 'Disconnected']],
              },
            ].map(({ label, value, set, options }) => (
              <div key={label}>
                <p className="text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.40)' }}>{label}</p>
                <select
                  value={value}
                  onChange={e => { set(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2 text-sm"
                  style={SELECT_STYLE}
                >
                  {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Results info ── */}
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.40)' }}>
          Showing {Math.min(start + 1, filtered.length)}–{Math.min(start + itemsPerPage, filtered.length)} of {filtered.length} machines
        </p>
        <select
          value={itemsPerPage}
          onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
          className="px-3 py-1.5 text-xs rounded-lg"
          style={SELECT_STYLE}
        >
          {[25, 50, 100, 250].map(n => <option key={n} value={n}>{n} per page</option>)}
        </select>
      </div>

      {/* ── Table ── */}
      <div className="rounded-2xl overflow-hidden" style={CARD}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <th className={thClass} style={thStyle} onClick={() => handleSort('name')}>
                  Name <SortIcon active={sortBy === 'name'} dir={sortDir} />
                </th>
                <th className={`${thClass} hidden md:table-cell`} style={thStyle} onClick={() => handleSort('machine_id')}>
                  Machine ID <SortIcon active={sortBy === 'machine_id'} dir={sortDir} />
                </th>
                <th className={`${thClass} hidden md:table-cell`} style={thStyle} onClick={() => handleSort('body_type')}>
                  Motor Type <SortIcon active={sortBy === 'body_type'} dir={sortDir} />
                </th>
                <th className={`${thClass} hidden lg:table-cell`} style={thStyle} onClick={() => handleSort('location')}>
                  Location <SortIcon active={sortBy === 'location'} dir={sortDir} />
                </th>
                <th className={`${thClass} hidden lg:table-cell`} style={thStyle} onClick={() => handleSort('customer_name')}>
                  Customer <SortIcon active={sortBy === 'customer_name'} dir={sortDir} />
                </th>
                <th className={thClass} style={thStyle} onClick={() => handleSort('asset_online')}>
                  Status <SortIcon active={sortBy === 'asset_online'} dir={sortDir} />
                </th>
                <th className={`${thClass} hidden sm:table-cell`} style={thStyle} onClick={() => handleSort('last_ping')}>
                  Last Ping <SortIcon active={sortBy === 'last_ping'} dir={sortDir} />
                </th>
                <th className={`${thClass} hidden sm:table-cell text-right`} style={thStyle} onClick={() => handleSort('stock_level')}>
                  Stock <SortIcon active={sortBy === 'stock_level'} dir={sortDir} />
                </th>
                <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wide text-right" style={thStyle}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {page.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <Building2 className="w-10 h-10 mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.15)' }} />
                    <p className="font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>No machines match your filters</p>
                  </td>
                </tr>
              ) : page.map(m => (
                <tr key={m.id} className="row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  {/* Name */}
                  <td className="py-3.5 px-4">
                    <p className="font-semibold text-white">{m.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>{m.machine_type}</p>
                  </td>

                  {/* Machine ID */}
                  <td className="py-3.5 px-4 hidden md:table-cell">
                    <p className="font-mono text-xs text-white">{m.machine_id}</p>
                    <p className="font-mono text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>{m.mac_id}</p>
                  </td>

                  {/* Motor Type */}
                  <td className="py-3.5 px-4 hidden md:table-cell">
                    <span
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={m.body_type === 'quad_motor'
                        ? { background: 'rgba(244,114,182,0.15)', color: '#F9A8D4' }
                        : { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.55)' }
                      }
                    >
                      {m.body_type === 'quad_motor' ? 'Quad Motor' : 'Single Motor'}
                    </span>
                  </td>

                  {/* Location */}
                  <td className="py-3.5 px-4 hidden lg:table-cell">
                    <div className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-sm">{m.location}</span>
                    </div>
                  </td>

                  {/* Customer */}
                  <td className="py-3.5 px-4 text-sm hidden lg:table-cell" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    {m.customer_name || '—'}
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-4">
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={m.asset_online
                        ? { background: 'rgba(52,211,153,0.15)', color: '#6EE7B7' }
                        : { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.40)' }
                      }
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${m.asset_online ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
                      {m.asset_online ? 'Online' : 'Offline'}
                    </span>
                    {m.status !== 'online' && m.status !== 'offline' && (
                      <span
                        className="ml-1.5 inline-block px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={{ background: 'rgba(251,191,36,0.15)', color: '#FDE68A' }}
                      >
                        {m.status}
                      </span>
                    )}
                  </td>

                  {/* Last ping */}
                  <td className="py-3.5 px-4 text-xs hidden sm:table-cell" style={{ color: 'rgba(255,255,255,0.40)' }}>
                    {m.last_ping ? formatDate(m.last_ping) : '—'}
                  </td>

                  {/* Stock */}
                  <td className="py-3.5 px-4 text-right hidden sm:table-cell">
                    {m.stock_level !== null ? (
                      <div
                        className={`relative inline-block ${m.motor_stock?.length ? 'cursor-help' : ''}`}
                        onMouseEnter={m.motor_stock?.length ? (e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const above = rect.top > 160; // enough room for the breakdown box above
                          setMotorTooltip({
                            top: above ? rect.top - 8 : rect.bottom + 8,
                            right: window.innerWidth - rect.right,
                            above,
                            stock: m.motor_stock!,
                          });
                        } : undefined}
                        onMouseLeave={m.motor_stock?.length ? () => setMotorTooltip(null) : undefined}
                      >
                        <span
                          className="font-semibold text-sm"
                          style={{ color: m.stock_level === 0 ? '#EF4444' : m.stock_level < 5 ? '#FBBF24' : 'white' }}
                        >
                          {m.stock_level}{m.max_capacity ? <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>/{m.max_capacity}</span> : null}
                          {m.stock_level === 0 && (
                            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.18)', color: '#FCA5A5' }}>Empty</span>
                          )}
                          {m.stock_level > 0 && m.stock_level < 5 && (
                            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.18)', color: '#FDE68A' }}>Low</span>
                          )}
                        </span>
                      </div>
                    ) : (
                      <span style={{ color: 'rgba(255,255,255,0.25)' }}>—</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link
                        href={`/admin/machines/${m.id}/edit${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ''}`}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                        style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.20)' }}
                        title="Edit machine"
                      >
                        <Edit2 className="w-3.5 h-3.5" style={{ color: '#60A5FA' }} />
                      </Link>
                      <button
                        onClick={() => handleDelete(m.id, m.name)}
                        disabled={deletingId === m.id}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40"
                        style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.20)' }}
                        title="Delete machine"
                      >
                        <Trash2 className="w-3.5 h-3.5" style={{ color: '#FCA5A5' }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.65)' }}
          >
            Previous
          </button>

          {(() => {
            const pages: number[] = [];
            if (totalPages <= 7) {
              for (let i = 1; i <= totalPages; i++) pages.push(i);
            } else {
              pages.push(1);
              if (currentPage > 3) pages.push(-1);
              for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
              if (currentPage < totalPages - 2) pages.push(-2);
              pages.push(totalPages);
            }
            return pages.map((p) =>
              p < 0 ? (
                <span key={p} className="px-1 text-sm" style={{ color: 'rgba(255,255,255,0.30)' }}>…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  className="w-9 h-9 rounded-xl text-sm font-semibold transition-colors"
                  style={currentPage === p
                    ? { background: 'linear-gradient(135deg,#F43F5E,#EC4899)', color: 'white' }
                    : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.65)' }
                  }
                >
                  {p}
                </button>
              )
            );
          })()}

          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.65)' }}
          >
            Next
          </button>
        </div>
      )}

      {motorTooltip && typeof document !== 'undefined' && createPortal(
        <div
          className="pointer-events-none fixed z-50 flex flex-col gap-1 whitespace-nowrap rounded-lg px-3 py-2 text-xs shadow-lg"
          style={{
            top: motorTooltip.top,
            right: motorTooltip.right,
            transform: motorTooltip.above ? 'translateY(-100%)' : undefined,
            background: '#1A1030',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          {motorTooltip.stock.map((s, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <span style={{ color: 'rgba(255,255,255,0.45)' }}>M{i + 1}</span>
              <span className="font-semibold text-white">{s}</span>
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
