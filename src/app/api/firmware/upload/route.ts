import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createHash } from 'crypto';
import { successResponse, errorResponse } from '@/lib/api-helpers';

const MAX_FIRMWARE_SIZE = 4 * 1024 * 1024; // ESP32 app partitions are well under this

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

  return { service, userId: user.id };
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { service, userId } = auth;

  const formData = await request.formData();
  const version = (formData.get('version') as string | null)?.trim();
  const notes = (formData.get('notes') as string | null)?.trim() || null;
  const file = formData.get('file') as File | null;

  if (!version) return errorResponse('version is required', 'MISSING_VERSION', 400);
  if (!file) return errorResponse('file is required', 'MISSING_FILE', 400);
  if (!file.name.endsWith('.bin')) return errorResponse('file must be a .bin firmware image', 'INVALID_FILE_TYPE', 400);
  if (file.size > MAX_FIRMWARE_SIZE) return errorResponse('file exceeds maximum firmware size', 'FILE_TOO_LARGE', 400);

  const { data: existing } = await service
    .from('firmware_versions')
    .select('id')
    .eq('version', version)
    .maybeSingle();

  if (existing) return errorResponse(`version "${version}" already exists`, 'VERSION_EXISTS', 409);

  const buffer = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const storagePath = `${version}/${file.name}`;

  const { error: uploadError } = await service.storage
    .from('firmware')
    .upload(storagePath, buffer, {
      contentType: 'application/octet-stream',
      upsert: false,
    });

  if (uploadError) {
    return errorResponse(`Storage upload failed: ${uploadError.message}`, 'UPLOAD_FAILED', 500);
  }

  const { data: firmwareVersion, error: insertError } = await service
    .from('firmware_versions')
    .insert({
      version,
      filename: file.name,
      storage_path: storagePath,
      sha256,
      size_bytes: buffer.length,
      notes,
      uploaded_by: userId,
    })
    .select()
    .single();

  if (insertError) {
    // Roll back the uploaded blob so a failed insert doesn't leave an orphaned file
    await service.storage.from('firmware').remove([storagePath]);
    return errorResponse(`Failed to record firmware version: ${insertError.message}`, 'INSERT_FAILED', 500);
  }

  return successResponse(firmwareVersion);
}
