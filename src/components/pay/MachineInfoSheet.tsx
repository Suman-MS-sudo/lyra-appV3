'use client';

import { useEffect, useRef } from 'react';
import { Copy, MapPin, MessageCircle, Package, Radio, RefreshCw, Wifi, X } from 'lucide-react';

export interface MachineStatus {
  name: string;
  machine_id: string;
  customer_name?: string;
  location?: string;
  asset_online: boolean;
  last_ping?: string;
  stock_level?: number;
  max_capacity?: number;
  connection_type?: string;
  wifi_rssi?: number;
  rfid_enabled?: boolean;
}

const SUPPORT_WHATSAPP = 'https://wa.me/918122378860';

function lastSeen(iso?: string) {
  if (!iso) return 'Never';
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  return `${Math.floor(hr / 24)} days ago`;
}

function signal(rssi?: number) {
  if (rssi == null) return null;
  if (rssi >= -60) return { label: 'Excellent', bars: 4 };
  if (rssi >= -70) return { label: 'Good', bars: 3 };
  if (rssi >= -80) return { label: 'Fair', bars: 2 };
  return { label: 'Weak', bars: 1 };
}

/**
 * Bottom sheet with the machine's live status — opened from the ⓘ button on
 * the payment page. Refreshes once on open (user-initiated, so it's cheap).
 */
export function MachineInfoSheet({
  open,
  machine,
  stockLeft,
  refreshing,
  onRefresh,
  onClose,
}: {
  open: boolean;
  machine: MachineStatus;
  stockLeft: number | null;
  refreshing: boolean;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  // Latest onClose without re-running the open effect (which moves focus) on every render
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  const online = machine.asset_online;
  const capacity = machine.max_capacity && machine.max_capacity > 0 ? machine.max_capacity : null;
  const stock = stockLeft ?? machine.stock_level ?? null;
  const pct = stock != null && capacity ? Math.max(0, Math.min(100, (stock / capacity) * 100)) : null;
  const sig = signal(machine.wifi_rssi);
  const via = (machine.connection_type || '').toLowerCase().includes('eth') ? 'Ethernet' : machine.connection_type ? 'Wi-Fi' : null;
  const reportHref = `${SUPPORT_WHATSAPP}?text=${encodeURIComponent(`Hi Lyra, I need help with machine ${machine.machine_id} (${machine.name}).`)}`;

  return (
    <div className="mi-root" role="dialog" aria-modal="true" aria-labelledby="mi-title">
      <button type="button" className="mi-backdrop" aria-label="Close" onClick={onClose} />
      <div className="mi-sheet">
        <span className="mi-grabber" aria-hidden="true" />

        <div className="mi-head">
          <div className="min-w-0">
            <p className="mi-eyebrow">Machine status</p>
            <h2 id="mi-title" className="mi-title">{machine.name}</h2>
            {(machine.customer_name || machine.location) && (
              <p className="mi-place">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{[machine.location, machine.customer_name].filter(Boolean).join(' · ')}</span>
              </p>
            )}
          </div>
          <button ref={closeRef} type="button" className="mi-close" aria-label="Close" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Hero status */}
        <div className={`mi-status ${online ? 'is-on' : 'is-off'}`}>
          <span className="mi-status-dot" aria-hidden="true" />
          <div className="flex-1">
            <p className="mi-status-label">{online ? 'Online · ready to dispense' : 'Offline · can’t dispense right now'}</p>
            <p className="mi-status-sub">Last check-in {lastSeen(machine.last_ping).toLowerCase()}</p>
          </div>
          <button type="button" className="mi-refresh" onClick={onRefresh} aria-label="Refresh status" disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin motion-reduce:animate-none' : ''}`} />
          </button>
        </div>

        <dl className="mi-grid">
          <div className="mi-tile is-wide">
            <dt><Package className="w-4 h-4" />Stock</dt>
            <dd>{stock != null ? `${stock}${capacity ? ` / ${capacity}` : ''}` : '—'}</dd>
            {pct != null && (
              <span className="mi-bar" aria-hidden="true">
                <span style={{ width: `${pct}%` }} className={pct < 20 ? 'is-low' : ''} />
              </span>
            )}
          </div>
          <div className="mi-tile">
            <dt><Wifi className="w-4 h-4" />Network</dt>
            <dd className="flex items-center gap-2">
              {sig ? sig.label : via || (online ? 'Connected' : '—')}
              {sig && (
                <span className="mi-bars" aria-hidden="true">
                  {[1, 2, 3, 4].map((b) => <i key={b} className={b <= sig.bars ? 'on' : ''} />)}
                </span>
              )}
            </dd>
          </div>
          <div className="mi-tile">
            <dt><Radio className="w-4 h-4" />Accepts</dt>
            <dd>{machine.rfid_enabled ? 'RFID card' : 'UPI'}</dd>
          </div>
          <div className="mi-tile is-wide">
            <dt>Machine ID</dt>
            <dd className="flex items-center gap-1.5">
              <span className="mi-mono truncate">{machine.machine_id}</span>
              <button
                type="button"
                className="mi-copy"
                aria-label="Copy machine ID"
                onClick={() => navigator.clipboard?.writeText(machine.machine_id).catch(() => {})}
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </dd>
          </div>
        </dl>

        <a href={reportHref} target="_blank" rel="noopener noreferrer" className="mi-report">
          <MessageCircle className="w-4 h-4" />
          Report a problem with this machine
        </a>
      </div>
    </div>
  );
}
