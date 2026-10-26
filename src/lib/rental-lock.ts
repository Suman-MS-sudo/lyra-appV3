import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Machine rentals (booked on lyraenterprise.co.in, see migration 20261026000001_rental_recharges.sql):
 * a rented machine whose rent is unpaid for more than the 7-day grace period is "locked", and
 * UPI / RFID vends are refused until the customer recharges.
 *
 * Fails open: if the check itself errors (e.g. migration not applied yet), the machine is treated
 * as unlocked so a database problem can never stop sales.
 */
export async function isRentalLocked(supabase: SupabaseClient, machineUuid: string | null | undefined): Promise<boolean> {
  if (!machineUuid) return false;
  try {
    const { data, error } = await supabase.rpc('machine_rental_locked', { p_machine: machineUuid });
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

export const RENTAL_LOCKED_MESSAGE =
  'This machine is paused because its rental is overdue. Please contact the site administrator.';

export const RENTAL_RECHARGE_URL = 'https://lyraenterprise.co.in/rental/recharge';
