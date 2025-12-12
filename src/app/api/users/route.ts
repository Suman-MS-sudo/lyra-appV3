import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { successResponse, errorResponse } from '@/lib/api-helpers';

export async function POST(request: NextRequest) {
  try {
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
      email,
      password,
      full_name,
      phone,
      account_type,
      role,
      organization_id
    } = body;

    if (!email || !password) {
      return errorResponse('Email and password are required', 'VALIDATION_ERROR', 400);
    }

    // Create user in auth
    const { data: authData, error: authError } = await serviceSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name || null
      }
    });

    if (authError || !authData.user) {
      console.error('Error creating user in auth:', authError);
      return errorResponse(authError?.message || 'Failed to create user', 'AUTH_ERROR', 500);
    }

    // Update profile with additional fields
    const { data: updatedProfile, error: profileError } = await serviceSupabase
      .from('profiles')
      .update({
        full_name: full_name || null,
        phone: phone || null,
        account_type: account_type || 'customer',
        role: role || 'customer',
        organization_id: organization_id || null
      })
      .eq('id', authData.user.id)
      .select()
      .single();

    if (profileError) {
      console.error('Error updating profile:', profileError);
      // User was created in auth but profile update failed
      // Consider whether to delete the auth user or just return the error
      return errorResponse(profileError.message, 'DATABASE_ERROR', 500);
    }

    return successResponse({
      user: authData.user,
      profile: updatedProfile
    });
  } catch (error: any) {
    console.error('Error in user creation API:', error);
    return errorResponse(error.message || 'Internal server error', 'INTERNAL_ERROR', 500);
  }
}
