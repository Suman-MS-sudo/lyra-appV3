'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Info, Loader2, Lock, Nfc, RefreshCw, ShieldCheck, WifiOff } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { OfflineAstronaut, ProductFan, QtySwitch, RollingPrice, SuccessMark, haptic } from './PayVisuals';
import { MachineInfoSheet } from './MachineInfoSheet';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: any;
  }
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  image_url?: string;
}

interface Machine {
  id: string;
  name: string;
  machine_id: string;
  customer_name: string;
  status: string;
  asset_online: boolean;
  last_ping?: string;
  rfid_enabled?: boolean;
  stock_level?: number;
  max_capacity?: number;
  location?: string;
  connection_type?: string;
  wifi_rssi?: number;
}

interface MachineProduct {
  id: string;
  product_id: string;
  stock: number;
  price: string;
  is_active: number;
  products: Product;
}

type LoadError = { type: 'invalid' | 'not_found' | 'server_error' | 'network_error' | 'error'; title: string; hint: string };

type PayState =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'checkout' }
  | { kind: 'verifying' }
  | { kind: 'success'; paymentId: string; amount: number; at: string; quantity: number }
  | { kind: 'failed'; message: string; paymentId?: string };

const MAX_PER_PAYMENT = 3; // same per-purchase cap the machine flow has always enforced
const ONLINE_WINDOW_MS = 10 * 60 * 1000; // machines ping every 5 min; 10 min = one missed ping of slack
const SUPPORT_WHATSAPP = 'https://wa.me/918122378860';
// Vector mark for on-page use (crisp at any density); PNG for Razorpay's checkout.
const BRAND_LOGO = '/brand/lyra-care-logo.png';
const BRAND_MARK = '/brand/lyra-care-logo.svg';

function withOnlineFlag(machine: Machine): Machine {
  if (!machine.last_ping) return machine;
  return { ...machine, asset_online: Date.now() - new Date(machine.last_ping).getTime() < ONLINE_WINDOW_MS };
}

// "lyra_SNVM_003" → "Lyra SNVM 003"
function formatDisplayName(raw: string): string {
  return raw
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => (w === w.toUpperCase() && w.length <= 5 ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
}

const rupees = (n: number) => `₹${Number.isInteger(n) ? n : n.toFixed(2)}`;

function loadRazorpay(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    document.querySelectorAll('script[src*="checkout.razorpay.com"]').forEach((s) => s.remove());
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve(!!window.Razorpay);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

/* ───────────────────────── Building blocks ───────────────────────── */

function Shell({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="pp-page">
      {/* Animated sky: drifting stars, aurora, breathing planet rim with light streaks */}
      <div className="pp-sky" aria-hidden="true">
        <span className="pp-stars" />
        <span className="pp-stars pp-stars-2" />
        <span className="pp-aurora pp-aurora-1" />
        <span className="pp-aurora pp-aurora-2" />
      </div>
      <div className="pp-rim" aria-hidden="true" />
      <div className="pp-rim-streak" aria-hidden="true" />
      <div className="pp-inner">
        <header className="pp-top">
          <Link href="/" className="pp-brand" aria-label="Lyra Care home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BRAND_MARK} alt="" width={34} height={34} className="pp-logo" />
            <span className="pp-brand-text">
              <span>Lyra Care</span>
              <small>BY LYRA ENTERPRISES</small>
            </span>
          </Link>
          <ThemeToggle />
        </header>
        <main className="pp-main">{children}</main>
        {footer && <footer className="pp-foot">{footer}</footer>}
      </div>
    </div>
  );
}

function MachinePill({ machine, fallbackId, onInfo }: { machine: Machine; fallbackId: string; onInfo?: () => void }) {
  return (
    <div className="pp-pill" title={machine.customer_name || undefined}>
      <span className={`pp-dot ${machine.asset_online ? 'is-on' : ''}`} />
      <span className="pp-pill-name">{formatDisplayName(machine.name || fallbackId)}</span>
      <span className="pp-pill-sep" />
      <span className={machine.asset_online ? 'text-[var(--success)]' : 'text-[var(--subtle)]'}>
        {machine.asset_online ? 'Online' : 'Offline'}
      </span>
      {onInfo && (
        <button type="button" className="pp-info-btn" onClick={onInfo} aria-label="Machine status and details">
          <Info className="w-[15px] h-[15px]" />
        </button>
      )}
    </div>
  );
}

const HelpLink = () => (
  <a href={SUPPORT_WHATSAPP} target="_blank" rel="noopener noreferrer" className="pp-help">
    Need help?
  </a>
);

/* ───────────────────────── Main component ───────────────────────── */

export function MachinePayment({ machineId }: { machineId: string }) {
  const [machine, setMachine] = useState<Machine | null>(null);
  const [products, setProducts] = useState<MachineProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [pay, setPay] = useState<PayState>({ kind: 'idle' });
  const [infoOpen, setInfoOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Status sheet: refresh once whenever the customer asks for it
  const refreshStatus = async () => {
    setRefreshing(true);
    await fetchMachine(true);
    setRefreshing(false);
  };

  // The background refresh is set up once; it reads live state through this ref.
  const busyRef = useRef(false);
  useEffect(() => {
    busyRef.current = pay.kind === 'starting' || pay.kind === 'checkout' || pay.kind === 'verifying';
  }, [pay.kind]);

  const fetchMachine = async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setLoadError(null);
    }
    try {
      const res = await fetch(`/api/machines/${encodeURIComponent(machineId)}/products`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !data.machine) {
        if (silent) return; // keep last-known-good data on a background refresh
        if (res.status === 400) setLoadError({ type: 'invalid', title: 'Invalid QR code', hint: 'Scan the QR on the machine again.' });
        else if (res.status === 404 || (res.ok && !data.machine)) setLoadError({ type: 'not_found', title: 'Machine not found', hint: 'Scan the QR on the machine again.' });
        else setLoadError({ type: 'server_error', title: 'Something went wrong', hint: 'Please try again in a moment.' });
        return;
      }
      setMachine(withOnlineFlag(data.machine));
      setProducts(data.products || []);
    } catch {
      if (!silent) setLoadError({ type: 'network_error', title: 'You’re offline', hint: 'Check your internet and try again.' });
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (!machineId.trim()) {
      setLoadError({ type: 'invalid', title: 'Invalid QR code', hint: 'Scan the QR on the machine again.' });
      setLoading(false);
      return;
    }
    fetchMachine();
    loadRazorpay(); // preload so the payment window opens instantly

    // Quiet refresh so a page left open still reflects stock/online status.
    // 5 min matches the machine's own ping cadence — faster just burns invocations.
    const id = setInterval(() => {
      if (!busyRef.current) fetchMachine(true);
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machineId]);

  const available = products.filter((p) => p.is_active !== 0);
  const selected =
    available.find((p) => p.product_id === selectedId && p.stock > 0) ?? available.find((p) => p.stock > 0) ?? null;
  const maxQty = selected ? Math.max(1, Math.min(MAX_PER_PAYMENT, selected.stock)) : 1;
  const qty = Math.min(quantity, maxQty);
  const unitPrice = selected ? parseFloat(selected.price) || 0 : 0;
  const total = unitPrice * qty;

  const startPayment = async () => {
    if (!machine || !selected) return;
    if (!machine.asset_online) {
      setPay({ kind: 'failed', message: 'Machine is offline. Try again shortly.' });
      return;
    }
    if (total <= 0) {
      setPay({ kind: 'failed', message: 'No price set for this item.' });
      return;
    }
    if (!window.Razorpay && !(await loadRazorpay())) {
      setPay({ kind: 'failed', message: 'Couldn’t open payment. Check your internet or ad blocker.' });
      return;
    }

    setPay({ kind: 'starting' });
    const items = [{ product_id: selected.product_id, name: selected.products.name, price: selected.price, quantity: qty, stock: selected.stock }];

    try {
      const orderRes = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: total, machineId: machine.machine_id }),
      });
      const order = await orderRes.json().catch(() => ({}));
      if (!orderRes.ok || !order.success) {
        setPay({ kind: 'failed', message: order.offline ? 'Machine is offline. Try again shortly.' : 'Couldn’t start payment. Please try again.' });
        return;
      }

      const rzp = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_live_lmKnnhDWFEBx4e',
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: 'Lyra Enterprises',
        description: `${selected.products.name} × ${qty} · ${machine.name || machine.machine_id}`,
        // Absolute: checkout runs on razorpay.com, where a relative path would resolve against their domain
        image: `${window.location.origin}${BRAND_LOGO}`,
        // Razorpay draws checkout in its own frame — it needs a literal colour, not a CSS variable.
        theme: { color: '#1f6bff' },
        // UPI first; other methods stay available below it.
        config: {
          display: {
            blocks: { upi: { name: 'Pay with UPI', instruments: [{ method: 'upi' }] } },
            sequence: ['block.upi'],
            preferences: { show_default_blocks: true },
          },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        handler: async (response: any) => {
          setPay({ kind: 'verifying' });
          try {
            const verifyRes = await fetch('/api/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                machineId: machine.machine_id,
                products: items,
              }),
            });
            const verified = await verifyRes.json().catch(() => ({}));
            if (verified.success) {
              setPay({
                kind: 'success',
                paymentId: response.razorpay_payment_id,
                amount: total,
                at: verified.transaction?.created_at || new Date().toISOString(),
                quantity: qty,
              });
              haptic(40);
              fetchMachine(true);
            } else {
              setPay({ kind: 'failed', paymentId: response.razorpay_payment_id, message: 'Paid, but not confirmed. Contact us with this reference.' });
            }
          } catch {
            setPay({ kind: 'failed', paymentId: response.razorpay_payment_id, message: 'Connection lost while confirming. Contact us with this reference.' });
          }
        },
        modal: { ondismiss: () => setPay((p) => (p.kind === 'checkout' ? { kind: 'idle' } : p)) },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rzp.on('payment.failed', (response: any) => {
        setPay({ kind: 'failed', message: response?.error?.description || 'Payment didn’t go through. No money was taken.' });
      });

      setPay({ kind: 'checkout' });
      rzp.open();
    } catch {
      setPay({ kind: 'failed', message: 'Couldn’t start payment. Please try again.' });
    }
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <Shell>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BRAND_MARK} alt="Lyra Care" width={84} height={84} className="pp-loader-logo" />
        <p className="pp-sub mt-6" role="status">Connecting to machine…</p>
      </Shell>
    );
  }

  /* ── Couldn't load ── */
  if (loadError || !machine) {
    const err = loadError ?? { type: 'error' as const, title: 'Something went wrong', hint: 'Please try again in a moment.' };
    const retryable = err.type === 'network_error' || err.type === 'server_error' || err.type === 'error';
    return (
      <Shell
        footer={
          <>
            {retryable ? (
              <button type="button" onClick={() => fetchMachine()} className="pp-pay">
                <RefreshCw className="w-5 h-5" /> Try again
              </button>
            ) : (
              <Link href="/" className="pp-pay pp-pay-ghost">Go to Lyra</Link>
            )}
            <HelpLink />
          </>
        }
      >
        <div className="pp-badge-icon is-warn">
          {err.type === 'network_error' ? <WifiOff className="w-7 h-7" /> : <AlertTriangle className="w-7 h-7" />}
        </div>
        <h1 className="pp-title">{err.title}</h1>
        <p className="pp-sub">{err.hint}</p>
      </Shell>
    );
  }

  /* ── RFID-only machine ── */
  if (machine.rfid_enabled) {
    return (
      <Shell footer={<HelpLink />}>
        <MachinePill machine={machine} fallbackId={machineId} />
        <div className="pp-badge-icon mt-10">
          <Nfc className="w-8 h-8" />
        </div>
        <h1 className="pp-title">Tap your card</h1>
        <p className="pp-sub">This machine uses RFID cards, not UPI.</p>
      </Shell>
    );
  }

  /* ── Paid ── */
  if (pay.kind === 'success') {
    return (
      <Shell
        footer={
          <>
            <button type="button" onClick={() => { setPay({ kind: 'idle' }); setQuantity(1); }} className="pp-pay pp-pay-ghost">
              Done
            </button>
            <p className="pp-ref">
              {rupees(pay.amount)} · {new Date(pay.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })} · <span className="font-mono">{pay.paymentId}</span>
            </p>
          </>
        }
      >
        <SuccessMark />
        <p className="pp-eyebrow mt-6">Payment verified</p>
        <h1 className="pp-title mt-2">Collect your {pay.quantity > 1 ? `${pay.quantity} napkins` : 'napkin'}</h1>
        {/* ~5s dispense cue, then the instruction — pure CSS, no timers */}
        <div className="dp" role="status">
          <div className="dp-track"><span className="dp-fill" /></div>
          <p className="dp-text">
            <span className="dp-a">Dispensing…</span>
            <span className="dp-b">Take {pay.quantity > 1 ? 'them' : 'it'} from the tray below</span>
          </p>
        </div>
      </Shell>
    );
  }

  /* ── Pay ── */
  const busy = pay.kind === 'starting' || pay.kind === 'checkout' || pay.kind === 'verifying';
  const offline = !machine.asset_online;
  const outOfStock = !selected;
  const canPay = !busy && !offline && !outOfStock && total > 0;

  let payLabel = <>Pay {rupees(total)}</>;
  if (pay.kind === 'starting') payLabel = <>Opening…</>;
  else if (pay.kind === 'checkout') payLabel = <>Waiting for payment…</>;
  else if (pay.kind === 'verifying') payLabel = <>Verifying…</>;
  else if (offline) payLabel = <>Machine offline</>;
  else if (outOfStock) payLabel = <>Out of stock</>;

  const priceShown = total || unitPrice;
  const rise = (d: number) => ({ className: 'pp-rise', style: { animationDelay: `${d}s` } as React.CSSProperties });

  return (
    <Shell
      footer={
        <>
          {pay.kind === 'failed' && (
            <p className="pp-error" role="alert">
              {pay.message}
              {pay.paymentId && <span className="block font-mono text-[11px] opacity-80 mt-0.5">{pay.paymentId}</span>}
            </p>
          )}
          <button
            type="button"
            onClick={startPayment}
            disabled={!canPay}
            className={`pp-pay pp-rise ${canPay ? 'is-split' : ''}`}
            style={{ animationDelay: '0.42s' }}
          >
            {canPay ? (
              <>
                {/* Apple Pay–style split: action on the left, amount on the right */}
                <span className="pp-pay-main"><Lock className="w-[17px] h-[17px]" strokeWidth={2.4} />Pay with UPI</span>
                <span className="pp-pay-amt">{rupees(total)}</span>
              </>
            ) : (
              <>
                {busy && <Loader2 className="w-5 h-5 animate-spin motion-reduce:animate-none" />}
                <span>{payLabel}</span>
              </>
            )}
          </button>
          <p className="pp-secure">
            <ShieldCheck className="w-3.5 h-3.5" /> Secured by Razorpay
            <span className="pp-secure-sep" />
            <span className="pp-upi">UPI</span>
            <span className="pp-secure-sep" />
            <HelpLink />
          </p>
        </>
      }
    >
      <div {...rise(0)}>
        <MachinePill machine={machine} fallbackId={machineId} onInfo={() => { setInfoOpen(true); refreshStatus(); }} />
      </div>

      <div {...rise(0.08)}>
        {offline ? (
          <OfflineAstronaut />
        ) : (
          <ProductFan count={selected ? qty : 1} imageUrl={selected?.products.image_url} dimmed={outOfStock} />
        )}
      </div>

      {available.length > 1 && (
        <div className="pp-chips pp-rise" style={{ animationDelay: '0.14s' }} role="radiogroup" aria-label="Choose an item">
          {available.map((p) => (
            <button
              key={p.product_id}
              type="button"
              role="radio"
              aria-checked={selected?.product_id === p.product_id}
              disabled={p.stock <= 0 || busy}
              onClick={() => { setSelectedId(p.product_id); setQuantity(1); }}
              className={`pp-chip ${selected?.product_id === p.product_id ? 'is-active' : ''}`}
            >
              {p.products.name}
            </button>
          ))}
        </div>
      )}

      {/* Product, rolling price, quantity — no box, just type and motion */}
      <div className="pp-info pp-rise" style={{ animationDelay: '0.18s' }}>
        <h1 className="pp-eyebrow">{selected ? selected.products.name : available[0]?.products.name || 'No items'}</h1>
        <RollingPrice amount={priceShown} />
        <p className={`pp-sub ${!offline && !outOfStock && selected!.stock < 5 ? 'is-low' : ''}`}>
          {offline
            ? 'Machine is offline — try again shortly'
            : outOfStock
              ? 'Out of stock'
              : [qty > 1 ? `${rupees(unitPrice)} each` : null, selected!.stock < 5 ? `Only ${selected!.stock} left` : null]
                  .filter(Boolean)
                  .join(' · ') || ' '}
        </p>
      </div>

      {selected && !offline && maxQty > 1 && (
        <div className="pp-rise w-full" style={{ animationDelay: '0.26s' }}>
          <QtySwitch max={maxQty} value={qty} disabled={busy} onChange={setQuantity} />
        </div>
      )}

      <MachineInfoSheet
        open={infoOpen}
        machine={{ ...machine, name: formatDisplayName(machine.name || machineId) }}
        stockLeft={selected ? selected.stock : null}
        refreshing={refreshing}
        onRefresh={refreshStatus}
        onClose={() => setInfoOpen(false)}
      />
    </Shell>
  );
}
