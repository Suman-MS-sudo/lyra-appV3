import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { successResponse, errorResponse } from '@/lib/api-helpers';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: errorResponse('Unauthorized', 'UNAUTHORIZED', 401) };

  const service = createAdminClient();
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { error: errorResponse('Admin access required', 'FORBIDDEN', 403) };
  }

  return { service };
}

// PATCH: archive/unarchive a firmware version, or set/clear its body-type
// compatibility tag. Doesn't touch the binary or its deployment history.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { service } = auth;
  const { id } = await params;

  const body = await request.json();
  const { archived, compatible_body_type } = body as {
    archived?: boolean;
    compatible_body_type?: 'single_motor' | 'quad_motor' | null;
  };

  const updateData: Record<string, unknown> = {};
  if (archived !== undefined) updateData.archived_at = archived ? new Date().toISOString() : null;
  if (compatible_body_type !== undefined) updateData.compatible_body_type = compatible_body_type;

  if (Object.keys(updateData).length === 0) {
    return errorResponse('Nothing to update -- provide archived and/or compatible_body_type', 'NO_FIELDS', 400);
  }

  const { data, error } = await service
    .from('firmware_versions')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) return errorResponse(error.message, 'UPDATE_FAILED', 500);

  return successResponse(data);
}

// DELETE: permanently remove a firmware version's binary + DB row. Blocked
// while any deployment referencing it is still in flight (pending or
// downloading) so an admin can't yank a build out from under a machine
// that's mid-update. Already-applied/failed deployment rows are left in
// place -- their firmware_version_id becomes a dangling reference, same as
// any historical foreign key to a deleted record; the deployments table
// still shows the version string was there via what was already applied at
// the time (vending_machines.firmware_version is a snapshot string, not a
// live join, so history display is unaffected).
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { service } = auth;
  const { id } = await params;

  const { data: version, error: fetchError } = await service
    .from('firmware_versions')
    .select('id, storage_path')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) return errorResponse(fetchError.message, 'FETCH_FAILED', 500);
  if (!version) return errorResponse('Firmware version not found', 'NOT_FOUND', 404);

  const { count: inFlightCount, error: countError } = await service
    .from('firmware_deployments')
    .select('id', { count: 'exact', head: true })
    .eq('firmware_version_id', id)
    .in('status', ['pending', 'downloading']);

  if (countError) return errorResponse(countError.message, 'CHECK_FAILED', 500);
  if ((inFlightCount ?? 0) > 0) {
    return errorResponse(
      'Cannot delete: this version has an in-flight deployment (pending or downloading) on at least one machine',
      'FIRMWARE_IN_USE',
      409
    );
  }

  const { error: deleteRowError } = await service
    .from('firmware_versions')
    .delete()
    .eq('id', id);

  if (deleteRowError) return errorResponse(deleteRowError.message, 'DELETE_FAILED', 500);

  // Storage cleanup is best-effort -- the DB row (the thing that lets this
  // version be deployed again) is already gone, so a failure here just
  // leaves an orphaned blob rather than a dangerous half-deleted version.
  await service.storage.from('firmware').remove([version.storage_path]);

  return successResponse({ id });
}
