import type { SupabaseClient } from '@supabase/supabase-js';

// Cards belonging to an organization with organizations.rfid_monthly_limit
// set are capped at that many taps per calendar month, regardless of
// card_type (prepaid credits / postpaid no-limit) or how many machines it's
// used on. Cards of any other organization (NULL limit, or none) are
// uncapped — today only Lucas TVS has a limit (5).
// See supabase/migrations/20260819000001_rfid_monthly_cap.sql and
// 20261007000001_rfid_monthly_limit_value.sql.

// Sent to machines as monthly_remaining for uncapped cards. The firmware
// refuses an offline tap once monthly_remaining hits 0 (a missing field reads
// as 0), so uncapped cards need a number it will never count down to between
// syncs rather than an absent value.
export const UNCAPPED_MONTHLY_REMAINING = 9999;

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

// Organization id -> monthly tap limit, for organizations that have one.
export async function fetchOrgMonthlyLimits(supabase: SupabaseClient): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('organizations')
    .select('id, rfid_monthly_limit')
    .not('rfid_monthly_limit', 'is', null);

  if (error) throw new Error(`Failed to load RFID monthly limit settings: ${error.message}`);
  return new Map((data || []).map(o => [o.id, o.rfid_monthly_limit as number]));
}
