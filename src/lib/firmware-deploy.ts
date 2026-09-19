import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Marks any existing pending/downloading deployment for each machine as
 * 'failed' (superseded), then always inserts a brand-new row for the new
 * request -- it deliberately does NOT mutate an existing row's
 * firmware_version_id in place anymore (see the correctness note below),
 * even though that means a machine can technically have more than one
 * 'failed' row in its history. /api/machine-ping only ever offers the most
 * recently requested pending/downloading row (see that route), so an old
 * failed row is simply invisible to future pings -- this is purely a
 * bookkeeping/history concern, not a functional one.
 *
 * Why not update in place (what this used to do): a device captures a
 * deployment's id and expected sha256 as local variables the moment its
 * ping approves an update, and does not re-check either mid-download. If a
 * second deploy request mutated that SAME row's firmware_version_id while
 * the device was still mid-flight on the first one, the device would
 * finish downloading/flashing the ORIGINAL version (its in-flight HTTP
 * response was already resolved against the original storage path before
 * the mutation), verify successfully against its own stale expected hash,
 * then report "applied" against a deployment_id that now points at the
 * SECOND version -- /api/machine-firmware-status would then write the
 * second version's number into vending_machines.firmware_version and mark
 * that row "applied", even though the device actually flashed the first
 * version. The device's own next ping self-corrects vending_machines.
 * firmware_version (it always reports its own true CURRENT_FIRMWARE_VERSION),
 * but firmware_deployments' history entry for that id would permanently
 * keep lying about which version it delivered. Always inserting a fresh
 * row instead means a deployment_id's firmware_version_id is immutable
 * once created -- whatever a device reports against it later is
 * necessarily describing that version, not a moving target.
 *
 * Shared by /api/firmware/deploy (push a chosen version) and
 * /api/firmware/rollback (push the machine's previous applied version).
 */
export async function createOrReplacePendingDeployments(
  service: SupabaseClient,
  params: { firmwareVersionId: string; machineIds: string[]; requestedBy: string }
): Promise<{ results: unknown[]; error: string | null }> {
  const { firmwareVersionId, machineIds, requestedBy } = params;
  const now = new Date().toISOString();

  const { data: existingPending } = await service
    .from('firmware_deployments')
    .select('id')
    .in('status', ['pending', 'downloading'])
    .in('machine_id', machineIds);

  const staleIds = (existingPending ?? []).map((d) => d.id);
  if (staleIds.length > 0) {
    const { error: supersedeError } = await service
      .from('firmware_deployments')
      .update({
        status: 'failed',
        error_message: 'superseded_by_newer_deployment',
        updated_at: now,
      })
      .in('id', staleIds);

    // Not fatal -- worst case a stale row lingers as pending/downloading
    // and a device might still be offered it, which is the same behavior
    // this whole mechanism already had to tolerate before this function
    // existed. Log and continue rather than blocking the new deployment
    // the admin actually asked for.
    if (supersedeError) {
      console.error('Failed to supersede stale firmware_deployments rows:', supersedeError.message);
    }
  }

  const { data: inserted, error: insertError } = await service
    .from('firmware_deployments')
    .insert(machineIds.map((machine_id) => ({
      firmware_version_id: firmwareVersionId,
      machine_id,
      status: 'pending' as const,
      requested_by: requestedBy,
      requested_at: now,
      updated_at: now,
    })))
    .select();

  if (insertError) return { results: [], error: insertError.message };

  return { results: inserted ?? [], error: null };
}
