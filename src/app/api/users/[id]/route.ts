import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { successResponse, errorResponse } from '@/lib/api-helpers';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return errorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if user is admin
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('account_type')
      .eq('id', user.id)
      .single();

    if (profile?.account_type !== 'admin') {
      return errorResponse('Forbidden', 'FORBIDDEN', 403);
    }

    const body = await request.json();
    const {
      full_name,
      phone,
      account_type,
      role,
      organization_id
    } = body;

    // Validate organization_id exists if provided
    if (organization_id) {
      const { data: org } = await serviceSupabase
        .from('organizations')
        .select('id')
        .eq('id', organization_id)
        .single();
      
      if (!org) {
        return errorResponse('Selected organization does not exist', 'VALIDATION_ERROR', 400);
      }
    }

    // Update user profile
    const { data: updatedUser, error } = await serviceSupabase
      .from('profiles')
      .update({
        full_name: full_name || null,
        phone: phone || null,
        account_type: account_type || 'customer',
        role: role || 'customer',
        organization_id: organization_id || null
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating user:', error);
      return errorResponse(error.message, 'DATABASE_ERROR', 500);
    }

    return successResponse(updatedUser);
  } catch (error: any) {
    console.error('Error in user update API:', error);
    return errorResponse(error.message || 'Internal server error', 'INTERNAL_ERROR', 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return errorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if user is admin
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('account_type')
      .eq('id', user.id)
      .single();

    if (profile?.account_type !== 'admin') {
      return errorResponse('Forbidden', 'FORBIDDEN', 403);
    }

    // Prevent deleting yourself
    if (id === user.id) {
      return errorResponse(
        'Cannot delete your own account',
        'VALIDATION_ERROR',
        400
      );
    }

    // Delete user from auth (this will cascade to profiles via trigger)
    const { error: authError } = await serviceSupabase.auth.admin.deleteUser(id);

    if (authError) {
      console.error('Error deleting user from auth:', authError);
      return errorResponse(authError.message, 'AUTH_ERROR', 500);
    }

    return successResponse({ message: 'User deleted successfully' });
  } catch (error: any) {
    console.error('Error in user delete API:', error);
    return errorResponse(error.message || 'Internal server error', 'INTERNAL_ERROR', 500);
  }
}
