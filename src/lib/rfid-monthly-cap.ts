// Every registered RFID card is capped at this many taps per calendar
// month, regardless of card_type (prepaid credits / postpaid no-limit) or
// how many machines it's used on. See supabase/migrations/20260819000001_rfid_monthly_cap.sql.
export const MONTHLY_VEND_LIMIT = 5;

export function vendMonthOf(date: Date): string {
  return date.toISOString().slice(0, 7); // UTC 'YYYY-MM'
}

// A card's monthly_vend_count only means something if monthly_vend_month
// matches the month `at` falls in — otherwise the count is from a prior
// month and the effective count for `at` is 0 (this is the "reset" — no
// cron job touches these columns).
export function effectiveMonthlyCount(
  storedMonth: string | null,
  storedCount: number,
  at: Date
): number {
  return storedMonth === vendMonthOf(at) ? storedCount : 0;
}
