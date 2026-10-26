/** Mirrors public.rental_state() (migration 20261026000001_rental_recharges.sql). */

export type RentalState = 'pending_install' | 'active' | 'grace' | 'locked' | 'ended' | 'cancelled';

export const RENTAL_GRACE_DAYS = 7;

const todayUTC = () => new Date().toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function rentalState(a: { status: string; start_date: string | null; paid_until: string | null }, today = todayUTC()): RentalState {
  if (a.status !== 'open') return a.status as RentalState;
  if (!a.start_date || !a.paid_until) return 'pending_install';
  if (a.paid_until >= today) return 'active';
  if (addDays(a.paid_until, RENTAL_GRACE_DAYS) >= today) return 'grace';
  return 'locked';
}

export const RENTAL_STATE_UI: Record<RentalState, { label: string; bg: string; fg: string }> = {
  pending_install: { label: 'Awaiting installation', bg: '#f5f5f7', fg: '#1d1d1f' },
  active: { label: 'Active', bg: '#e8f8ee', fg: '#137333' },
  grace: { label: 'Overdue (grace)', bg: '#fff4e0', fg: '#a05a00' },
  locked: { label: 'Paused (unpaid)', bg: '#fbe9e9', fg: '#c8102e' },
  ended: { label: 'Ended', bg: '#f5f5f7', fg: '#6e6e73' },
  cancelled: { label: 'Cancelled', bg: '#f5f5f7', fg: '#6e6e73' },
};

export const fmtDate = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—';
