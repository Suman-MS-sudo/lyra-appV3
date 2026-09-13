import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { successResponse, errorResponse } from '@/lib/api-helpers';

export async function GET() {
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

  const { data: versions, error } = await service
    .from('firmware_versions')
    .select('id, version, filename, sha256, size_bytes, notes, created_at')
    .order('created_at', { ascending: false });

  if (error) return errorResponse(error.message, 'QUERY_FAILED', 500);

  return successResponse(versions);
}
