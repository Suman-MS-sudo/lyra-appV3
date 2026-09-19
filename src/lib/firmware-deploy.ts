import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Creates a pending deployment for each machine, replacing any existing
 * pending deployment for that machine rather than stacking a second one
 * (enforced at the DB level by a partial unique index on
 * firmware_deployments(machine_id) WHERE status='pending' -- see
 * 20260913000001_firmware_ota.sql). supabase-js's upsert can't target that
 * partial-unique predicate directly, so this does an explicit
 * update-existing / insert-new split instead.
 *
 * Shared by /api/firmware/deploy (push a chosen version) and
 * /api/firmware/rollback (push the machine's previous applied version) so
 * the replace-not-stack behavior only lives in one place.
 */
export async function createOrReplacePendingDeployments(
  service: SupabaseClient,
  params: { firmwareVersionId: string; machineIds: string[]; requestedBy: string }
): Promise<{ results: unknown[]; error: string | null }> {
  const { firmwareVersionId, machineIds, requestedBy } = params;
  const now = new Date().toISOString();

  // Matches 'downloading' too, not just 'pending': a device that reports
  // "downloading" and then never finishes (crash, power loss, watchdog
  // reset mid-transfer) leaves that row stuck in 'downloading' forever --
  // re-deploying to the same machine must reuse/replace that row, not
  // insert a second one alongside it. /api/machine-ping's own pending-or-
  // downloading lookup uses .maybeSingle(), which errors out (silently,
  // since only `data` is destructured there) the moment more than one row
  // matches a machine_id -- two rows here means the ping's OTA check goes
  // dark with no error surfaced anywhere, exactly the bug this away.
  const { data: existingPending } = await service
    .from('firmware_deployments')
    .select('id, machine_id')
    .in('status', ['pending', 'downloading'])
    .in('machine_id', machineIds);

  const existingByMachine = new Map((existingPending ?? []).map((d) => [d.machine_id, d.id]));
  const toUpdateIds = machineIds.filter((id) => existingByMachine.has(id)).map((id) => existingByMachine.get(id)!);
  const toInsert = machineIds.filter((id) => !existingByMachine.has(id));

  const results: unknown[] = [];

  if (toUpdateIds.length > 0) {
    const { data: updated, error: updateError } = await service
      .from('firmware_deployments')
      .update({
        firmware_version_id: firmwareVersionId,
        error_message: null,
        requested_by: requestedBy,
        requested_at: now,
        applied_at: null,
        updated_at: now,
      })
      .in('id', toUpdateIds)
      .select();

    if (updateError) return { results, error: updateError.message };
    results.push(...(updated ?? []));
  }

  if (toInsert.length > 0) {
    const { data: inserted, error: insertError } = await service
      .from('firmware_deployments')
      .insert(toInsert.map((machine_id) => ({
        firmware_version_id: firmwareVersionId,
        machine_id,
        status: 'pending' as const,
        requested_by: requestedBy,
        requested_at: now,
        updated_at: now,
      })))
      .select();

    if (insertError) return { results, error: insertError.message };
    results.push(...(inserted ?? []));
  }

  return { results, error: null };
}
