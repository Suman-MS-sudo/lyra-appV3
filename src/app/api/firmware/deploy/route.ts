import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { createOrReplacePendingDeployments } from '@/lib/firmware-deploy';

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
  const { firmware_version_id, machine_ids, force } = body as {
    firmware_version_id?: string;
    machine_ids?: string[];
    force?: boolean;
  };

  if (!firmware_version_id) return errorResponse('firmware_version_id is required', 'MISSING_FIRMWARE_VERSION', 400);
  if (!Array.isArray(machine_ids) || machine_ids.length === 0) {
    return errorResponse('machine_ids must be a non-empty array', 'MISSING_MACHINE_IDS', 400);
  }

  const { data: firmwareVersion } = await service
    .from('firmware_versions')
    .select('id, archived_at, compatible_body_type')
    .eq('id', firmware_version_id)
    .maybeSingle();

  if (!firmwareVersion) return errorResponse('Firmware version not found', 'FIRMWARE_NOT_FOUND', 404);

  if (firmwareVersion.archived_at) {
    return errorResponse('This firmware version is archived and cannot be deployed', 'FIRMWARE_ARCHIVED', 409);
  }

  if (firmwareVersion.compatible_body_type && !force) {
    const { data: incompatible } = await service
      .from('vending_machines')
      .select('id, name, body_type')
      .in('id', machine_ids)
      .neq('body_type', firmwareVersion.compatible_body_type);

    if (incompatible && incompatible.length > 0) {
      const names = incompatible.map((m) => `${m.name} (${m.body_type})`).join(', ');
      return errorResponse(
        `This build is tagged for ${firmwareVersion.compatible_body_type} only -- incompatible: ${names}`,
        'INCOMPATIBLE_BODY_TYPE',
        409
      );
    }
  }

  const { results, error } = await createOrReplacePendingDeployments(service, {
    firmwareVersionId: firmware_version_id,
    machineIds: machine_ids,
    requestedBy: user.id,
  });

  if (error) return errorResponse(error, 'DEPLOY_FAILED', 500);

  return successResponse(results);
}
