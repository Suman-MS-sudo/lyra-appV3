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
  pending_install: { label: 'Awaiting installation', bg: 'var(--surface-2)', fg: 'var(--fg)' },
  active: { label: 'Active', bg: 'var(--success-bg)', fg: 'var(--success)' },
  grace: { label: 'Overdue (grace)', bg: 'var(--warning-bg)', fg: 'var(--warning)' },
  locked: { label: 'Paused (unpaid)', bg: 'var(--danger-bg)', fg: 'var(--danger)' },
  ended: { label: 'Ended', bg: 'var(--surface-2)', fg: 'var(--muted)' },
  cancelled: { label: 'Cancelled', bg: 'var(--surface-2)', fg: 'var(--muted)' },
};

export const fmtDate = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—';
