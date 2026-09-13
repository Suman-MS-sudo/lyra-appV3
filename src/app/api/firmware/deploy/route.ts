import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { successResponse, errorResponse } from '@/lib/api-helpers';

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
  const { firmware_version_id, machine_ids } = body as { firmware_version_id?: string; machine_ids?: string[] };

  if (!firmware_version_id) return errorResponse('firmware_version_id is required', 'MISSING_FIRMWARE_VERSION', 400);
  if (!Array.isArray(machine_ids) || machine_ids.length === 0) {
    return errorResponse('machine_ids must be a non-empty array', 'MISSING_MACHINE_IDS', 400);
  }

  const { data: firmwareVersion } = await service
    .from('firmware_versions')
    .select('id')
    .eq('id', firmware_version_id)
    .maybeSingle();

  if (!firmwareVersion) return errorResponse('Firmware version not found', 'FIRMWARE_NOT_FOUND', 404);

  // Deploying again to an already-pending machine replaces its pending
  // deployment rather than stacking a second one. The DB enforces this with
  // a partial unique index (only among status='pending' rows), which
  // supabase-js's upsert can't target directly (it can't express the WHERE
  // predicate), so do it as an explicit update-existing / insert-new split.
  const now = new Date().toISOString();

  const { data: existingPending } = await service
    .from('firmware_deployments')
    .select('id, machine_id')
    .eq('status', 'pending')
    .in('machine_id', machine_ids);

  const existingByMachine = new Map((existingPending ?? []).map((d) => [d.machine_id, d.id]));
  const toUpdateIds = machine_ids.filter((id) => existingByMachine.has(id)).map((id) => existingByMachine.get(id)!);
  const toInsert = machine_ids.filter((id) => !existingByMachine.has(id));

  const results: unknown[] = [];

  if (toUpdateIds.length > 0) {
    const { data: updated, error: updateError } = await service
      .from('firmware_deployments')
      .update({
        firmware_version_id,
        error_message: null,
        requested_by: user.id,
        requested_at: now,
        applied_at: null,
        updated_at: now,
      })
      .in('id', toUpdateIds)
      .select();

    if (updateError) return errorResponse(updateError.message, 'DEPLOY_UPDATE_FAILED', 500);
    results.push(...(updated ?? []));
  }

  if (toInsert.length > 0) {
    const { data: inserted, error: insertError } = await service
      .from('firmware_deployments')
      .insert(toInsert.map((machine_id) => ({
        firmware_version_id,
        machine_id,
        status: 'pending' as const,
        requested_by: user.id,
        requested_at: now,
        updated_at: now,
      })))
      .select();

    if (insertError) return errorResponse(insertError.message, 'DEPLOY_INSERT_FAILED', 500);
    results.push(...(inserted ?? []));
  }

  return successResponse(results);
}
