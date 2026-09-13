import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { successResponse, errorResponse } from '@/lib/api-helpers';

export async function GET(request: NextRequest) {
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

  const firmwareVersionId = request.nextUrl.searchParams.get('firmware_version_id');

  let query = service
    .from('firmware_deployments')
    .select('id, status, error_message, requested_at, applied_at, updated_at, firmware_version_id, vending_machines(id, name, machine_id)')
    .order('updated_at', { ascending: false });

  if (firmwareVersionId) query = query.eq('firmware_version_id', firmwareVersionId);

  const { data: deployments, error } = await query;

  if (error) return errorResponse(error.message, 'QUERY_FAILED', 500);

  return successResponse(deployments);
}
