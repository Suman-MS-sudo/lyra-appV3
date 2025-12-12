import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * Delete Machine API
 * 
 * Endpoint: DELETE /api/machines/delete
 * Body: { machineId }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { machineId } = body;

    if (!machineId) {
      return errorResponse('Machine ID is required', 'MISSING_ID', 400);
    }

    // Use service role to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Delete machine (cascade will handle related records)
    const { error: deleteError } = await supabase
      .from('vending_machines')
      .delete()
      .eq('id', machineId);

    if (deleteError) {
      console.error('Delete machine error:', deleteError);
      return errorResponse('Failed to delete machine', 'DELETE_FAILED', 500);
    }

    console.log(`🗑️ Machine deleted: ${machineId}`);

    return successResponse({
      message: 'Machine deleted successfully',
    });

  } catch (error: any) {
    console.error('Delete machine error:', error);
    return errorResponse(error.message || 'Internal server error', 'INTERNAL_ERROR', 500);
  }
}
