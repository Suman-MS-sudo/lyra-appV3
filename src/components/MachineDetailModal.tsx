'use client';

import { useEffect, useState } from 'react';
import {
  X, Wifi, Cpu, Thermometer, Gauge, Clock, MapPin, Building2,
  Nfc, Coins, Smartphone, Package, RadioTower,
} from 'lucide-react';

type FeedType = 'upi' | 'coin' | 'rfid';

type FeedItem = {
  id: string;
  type: FeedType;
  amount: number;
  product_name: string | null;
  dispensed: boolean;
  created_at: string;
  holder_name?: string | null;
};

type ChartDay = { date: string; coin: number; upi: number; rfid: number; revenue: number };

type MachineDetail = {
  id: string;
  name: string;
  machine_id: string;
  mac_id: string;
  location: string;
  status: string;
  customer_name: string | null;
  machine_type: string | null;
  body_type: string | null;
  max_capacity: number | null;
  motor_stock: number[] | null;
  stock_level: number | null;
  rfid_enabled: boolean;
  asset_online: boolean;
  last_ping: string | null;
  firmware_version: string | null;
  wifi_rssi: number | null;
  free_heap: number | null;
  uptime: number | null;
  network_speed: number | null;
  temperature: number | null;
  created_at: string;
};

const muted = { color: '#6e6e73' };
const cardBg = { background: '#f5f5f7', border: '1px solid #e5e5e7' };

function relativeTime(iso: string | null) {
  if (!iso) return 'Never';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatUptime(ms: number | null) {
  if (!ms) return '—';
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function rssiLabel(rssi: number | null) {
  if (rssi === null || rssi === undefined) return { label: '—', color: '#86868b' };
  if (rssi >= -60) return { label: 'Excellent', color: '#1d7a3c' };
  if (rssi >= -75) return { label: 'Good', color: '#0071e3' };
  if (rssi >= -85) return { label: 'Weak', color: '#9a6400' };
  return { label: 'Poor', color: '#c8102e' };
}

const TYPE_META: Record<FeedType, { icon: any; label: string; color: string }> = {
  upi: { icon: Smartphone, label: 'UPI', color: '#0071e3' },
  coin: { icon: Coins, label: 'Coin', color: '#9a6400' },
  rfid: { icon: Nfc, label: 'RFID', color: '#7c6fff' },
};

function TransactionChart({ chart }: { chart: ChartDay[] }) {
  const width = 640;
  const height = 160;
  const padLeft = 32;
  const padBottom = 20;
  const plotW = width - padLeft - 8;
  const plotH = height - padBottom - 8;
  const maxCount = Math.max(1, ...chart.map(d => d.coin + d.upi + d.rfid));
  const barW = plotW / chart.length;

  const maxRevenue = Math.max(1, ...chart.map(d => d.revenue));
  const linePoints = chart.map((d, i) => {
    const x = padLeft + i * barW + barW / 2;
    const y = 8 + plotH - (d.revenue / maxRevenue) * plotH;
    return `${x},${y}`;
  }).join(' ');

  const [hover, setHover] = useState<number | null>(null);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Daily transactions">
        {[0, 0.5, 1].map(f => (
          <line key={f} x1={padLeft} x2={width} y1={8 + plotH * f} y2={8 + plotH * f} stroke="#e5e5e7" strokeWidth={1} />
        ))}
        {chart.map((d, i) => {
          const x = padLeft + i * barW;
          const coinH = (d.coin / maxCount) * plotH;
          const upiH = (d.upi / maxCount) * plotH;
          const rfidH = (d.rfid / maxCount) * plotH;
          const barInnerW = Math.max(2, barW * 0.6);
          const bx = x + (barW - barInnerW) / 2;
          let yCursor = 8 + plotH;
          const segments: { h: number; color: string }[] = [
            { h: coinH, color: '#9a6400' },
            { h: upiH, color: '#0071e3' },
            { h: rfidH, color: '#7c6fff' },
          ];
          return (
            <g key={d.date}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(h => h === i ? null : h)}
            >
              <rect x={x} y={8} width={barW} height={plotH} fill="transparent" />
              {segments.map((seg, si) => {
                if (seg.h <= 0) return null;
                yCursor -= seg.h;
                return <rect key={si} x={bx} y={yCursor} width={barInnerW} height={seg.h} fill={seg.color} opacity={hover === null || hover === i ? 1 : 0.35} rx={1} />;
              })}
              {hover === i && (
                <line x1={x + barW / 2} x2={x + barW / 2} y1={8} y2={8 + plotH} stroke="#a1a1a6" strokeDasharray="3,3" />
              )}
            </g>
          );
        })}
        <polyline points={linePoints} fill="none" stroke="#43e97b" strokeWidth={2} opacity={0.9} />
        {chart.map((d, i) => {
          if (i % Math.ceil(chart.length / 7) !== 0) return null;
          const x = padLeft + i * barW + barW / 2;
          return (
            <text key={d.date} x={x} y={height - 4} fontSize="9" fill="#86868b" textAnchor="middle">
              {new Date(d.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
            </text>
          );
        })}
      </svg>
      {hover !== null && chart[hover] && (
        <div
          className="absolute top-0 rounded-lg px-3 py-2 text-xs shadow-lg pointer-events-none"
          style={{ left: `${(hover / chart.length) * 100}%`, background: '#1A1030', color: '#fff', border: '1px solid #e5e5e7', transform: 'translateX(-10%)' }}
        >
          <p className="font-semibold mb-1">{new Date(chart[hover].date).toLocaleDateString()}</p>
          <p style={{ color: '#9a6400' }}>Coin: {chart[hover].coin}</p>
          <p style={{ color: '#93C5FD' }}>UPI: {chart[hover].upi}</p>
          <p style={{ color: '#c4b8ff' }}>RFID: {chart[hover].rfid}</p>
          <p style={{ color: '#43e97b' }}>Revenue: ₹{chart[hover].revenue.toFixed(2)}</p>
        </div>
      )}
      <div className="flex items-center gap-4 mt-2 text-xs flex-wrap" style={muted}>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#9a6400' }} /> Coin</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#0071e3' }} /> UPI</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#7c6fff' }} /> RFID</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5" style={{ background: '#43e97b' }} /> Revenue</span>
      </div>
    </div>
  );
}

export default function MachineDetailModal({ machineId, onClose }: { machineId: string; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [machine, setMachine] = useState<MachineDetail | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<FeedItem[]>([]);
  const [chart, setChart] = useState<ChartDay[]>([]);
  const [totals, setTotals] = useState({ transactions: 0, revenue: 0 });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetch(`/api/machines/${machineId}/detail`)
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load machine details');
        return data;
      })
      .then(data => {
        if (cancelled) return;
        setMachine(data.machine);
        setRecentTransactions(data.recentTransactions || []);
        setChart(data.chart || []);
        setTotals(data.totals || { transactions: 0, revenue: 0 });
      })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [machineId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const rssi = rssiLabel(machine?.wifi_rssi ?? null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(5,3,18,0.72)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl my-8 max-h-[90vh] overflow-y-auto"
        style={{ background: '#1c1937', border: '1px solid #e5e5e7' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 sticky top-0 z-10" style={{ background: '#1c1937', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              {machine?.name || 'Loading…'}
              {machine && (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                  style={machine.asset_online
                    ? { background: 'rgba(29,122,60,0.20)', color: '#43e97b' }
                    : { background: 'rgba(255,255,255,0.08)', color: '#a1a1a6' }}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${machine.asset_online ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
                  {machine.asset_online ? 'Online' : 'Offline'}
                </span>
              )}
            </h3>
            {machine && <p className="text-xs mt-0.5" style={{ color: '#a1a1a6' }}>{machine.location}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <X className="w-5 h-5" style={{ color: '#a1a1a6' }} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {loading ? (
            <div className="text-center py-16 text-sm" style={{ color: '#a1a1a6' }}>Loading machine details...</div>
          ) : error ? (
            <div className="px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(200,16,46,0.15)', color: '#ff8080' }}>{error}</div>
          ) : machine ? (
            <>
              {/* Info grid */}
              <div className="rounded-2xl p-4" style={cardBg}>
                <h4 className="text-xs font-semibold uppercase tracking-wide mb-3" style={muted}>Machine Info</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-xs" style={muted}>Machine ID</p>
                    <p className="font-mono text-[#1d1d1f]">{machine.machine_id}</p>
                  </div>
                  <div>
                    <p className="text-xs" style={muted}>MAC ID</p>
                    <p className="font-mono text-[#1d1d1f]">{machine.mac_id}</p>
                  </div>
                  <div>
                    <p className="text-xs flex items-center gap-1" style={muted}><Building2 className="w-3 h-3" /> Customer</p>
                    <p className="text-[#1d1d1f]">{machine.customer_name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs flex items-center gap-1" style={muted}><MapPin className="w-3 h-3" /> Location</p>
                    <p className="text-[#1d1d1f]">{machine.location}</p>
                  </div>
                  <div>
                    <p className="text-xs" style={muted}>Body Type</p>
                    <p className="text-[#1d1d1f]">
                      {machine.body_type === 'quad_motor' ? 'Quad Motor' : machine.body_type === 'single_motor_35' ? 'Single Motor (35)' : machine.body_type || machine.machine_type || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs flex items-center gap-1" style={muted}><Nfc className="w-3 h-3" /> RFID Payments</p>
                    <p className="text-[#1d1d1f]">{machine.rfid_enabled ? 'Enabled' : 'Disabled'}</p>
                  </div>
                  <div>
                    <p className="text-xs flex items-center gap-1" style={muted}><RadioTower className="w-3 h-3" /> Firmware</p>
                    <p className="font-mono text-[#1d1d1f]">{machine.firmware_version || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs" style={muted}>Added</p>
                    <p className="text-[#1d1d1f]">{new Date(machine.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              {/* Health + Sync */}
              <div className="rounded-2xl p-4" style={cardBg}>
                <h4 className="text-xs font-semibold uppercase tracking-wide mb-3" style={muted}>Health & Sync</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-xs flex items-center gap-1" style={muted}><Clock className="w-3 h-3" /> Last Sync</p>
                    <p className="text-[#1d1d1f] font-medium">{relativeTime(machine.last_ping)}</p>
                  </div>
                  <div>
                    <p className="text-xs flex items-center gap-1" style={muted}><Wifi className="w-3 h-3" /> WiFi Signal</p>
                    <p className="font-medium" style={{ color: rssi.color }}>{rssi.label}{machine.wifi_rssi !== null ? ` (${machine.wifi_rssi} dBm)` : ''}</p>
                  </div>
                  <div>
                    <p className="text-xs flex items-center gap-1" style={muted}><Gauge className="w-3 h-3" /> Network Speed</p>
                    <p className="text-[#1d1d1f] font-medium">{machine.network_speed ? `${machine.network_speed} KB/s` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs flex items-center gap-1" style={muted}><Cpu className="w-3 h-3" /> Free Memory</p>
                    <p className="text-[#1d1d1f] font-medium">{machine.free_heap ? `${(machine.free_heap / 1024).toFixed(0)} KB` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs flex items-center gap-1" style={muted}><Thermometer className="w-3 h-3" /> Temperature</p>
                    <p className="text-[#1d1d1f] font-medium">{machine.temperature !== null ? `${machine.temperature}°C` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs" style={muted}>Device Uptime</p>
                    <p className="text-[#1d1d1f] font-medium">{formatUptime(machine.uptime)}</p>
                  </div>
                  <div>
                    <p className="text-xs flex items-center gap-1" style={muted}><Package className="w-3 h-3" /> Stock</p>
                    <p className="text-[#1d1d1f] font-medium">
                      {machine.stock_level ?? '—'}{machine.max_capacity ? ` / ${machine.max_capacity}` : ''}
                    </p>
                  </div>
                  {machine.motor_stock && machine.motor_stock.length > 0 && (
                    <div className="col-span-2 sm:col-span-4">
                      <p className="text-xs mb-1" style={muted}>Per-Motor Stock</p>
                      <div className="flex gap-3 flex-wrap">
                        {machine.motor_stock.map((s, i) => (
                          <span key={i} className="text-xs px-2 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.06)', color: '#e5e5e7' }}>
                            M{i + 1}: <span className="font-semibold">{s}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Chart */}
              <div className="rounded-2xl p-4" style={cardBg}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wide" style={muted}>Transactions — Last 14 Days</h4>
                  <p className="text-xs" style={muted}>{totals.transactions} txns · ₹{totals.revenue.toFixed(2)}</p>
                </div>
                {chart.length > 0 ? <TransactionChart chart={chart} /> : (
                  <p className="text-sm text-center py-8" style={muted}>No transaction data yet</p>
                )}
              </div>

              {/* Recent transactions */}
              <div className="rounded-2xl p-4" style={cardBg}>
                <h4 className="text-xs font-semibold uppercase tracking-wide mb-3" style={muted}>Recent Transactions</h4>
                {recentTransactions.length === 0 ? (
                  <p className="text-sm text-center py-8" style={muted}>No transactions yet</p>
                ) : (
                  <div className="space-y-1">
                    {recentTransactions.map(tx => {
                      const meta = TYPE_META[tx.type];
                      const Icon = meta.icon;
                      return (
                        <div key={`${tx.type}-${tx.id}`} className="flex items-center justify-between py-2 px-2 rounded-lg" style={{ borderBottom: '1px solid #e5e5e7' }}>
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${meta.color}1A` }}>
                              <Icon className="w-4 h-4" style={{ color: meta.color }} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-[#1d1d1f] truncate">
                                {tx.product_name || 'Product'}
                                {tx.holder_name && <span style={muted}> · {tx.holder_name}</span>}
                              </p>
                              <p className="text-xs" style={muted}>{meta.label} · {relativeTime(tx.created_at)}</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold text-[#1d1d1f]">₹{tx.amount.toFixed(2)}</p>
                            <p className="text-xs" style={{ color: tx.dispensed ? '#1d7a3c' : '#c8102e' }}>{tx.dispensed ? 'Dispensed' : 'Failed'}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
