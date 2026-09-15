import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { createOrReplacePendingDeployments } from '@/lib/firmware-deploy';

// Rolls a machine back to the version it ran immediately before its current
// one, by finding its two most recent *applied* deployments and pushing the
// older of the two as a fresh pending deployment -- reuses the exact same
// pending-deployment machinery as a normal push, so it goes through the
// same OTA/checksum/rollback-safety path on the device, nothing special.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return errorResponse('Unauthorized', 'UNAUTHORIZED', 401);

  const service = createAdminClient();
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') return errorResponse('Admin access required', 'FORBIDDEN', 403);

  const body = await request.json();
  const { machine_id } = body as { machine_id?: string };
  if (!machine_id) return errorResponse('machine_id is required', 'MISSING_MACHINE_ID', 400);

  const { data: recentApplied, error: historyError } = await service
    .from('firmware_deployments')
    .select('id, firmware_version_id, applied_at')
    .eq('machine_id', machine_id)
    .eq('status', 'applied')
    .order('applied_at', { ascending: false })
    .limit(2);

  if (historyError) return errorResponse(historyError.message, 'HISTORY_FAILED', 500);

  if (!recentApplied || recentApplied.length < 2) {
    return errorResponse('No previous applied version to roll back to for this machine', 'NO_PREVIOUS_VERSION', 400);
  }

  const previousVersionId = recentApplied[1].firmware_version_id;

  const { data: previousVersion } = await service
    .from('firmware_versions')
    .select('id, archived_at')
    .eq('id', previousVersionId)
    .maybeSingle();

  if (!previousVersion) {
    return errorResponse('The previous firmware version no longer exists (may have been deleted)', 'PREVIOUS_VERSION_DELETED', 409);
  }

  // Rollback is an explicit recovery action -- an archived build is still a
  // legitimate rollback target (it was working when this machine ran it),
  // so this intentionally doesn't block on archived_at the way a normal
  // forward deploy does.

  const { results, error } = await createOrReplacePendingDeployments(service, {
    firmwareVersionId: previousVersionId,
    machineIds: [machine_id],
    requestedBy: user.id,
  });

  if (error) return errorResponse(error, 'ROLLBACK_FAILED', 500);

  return successResponse(results);
}
