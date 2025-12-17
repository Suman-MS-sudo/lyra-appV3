import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { randomBytes } from 'crypto';

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
      full_name,
      phone,
      account_type,
      role,
      organization_id
    } = body;

    if (!email) {
      return errorResponse('Email is required', 'VALIDATION_ERROR', 400);
    }

    // Check if user already exists in auth
    const { data: existingUsers } = await serviceSupabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    let authData;
    
    if (existingUser) {
      // User already exists in auth, use existing user
      authData = { user: existingUser };
      
      // Check if profile exists
      const { data: existingProfile } = await serviceSupabase
        .from('profiles')
        .select('id, role, account_type')
        .eq('id', existingUser.id)
        .single();
        
      if (existingProfile) {
        return errorResponse(
          `User with email ${email} already exists with role: ${existingProfile.role}`, 
          'USER_EXISTS', 
          409
        );
      }
      
      console.log(`User ${email} exists in auth but has no profile. Creating profile...`);
    } else {
      // Create user in auth without password (will need to set via reset email)
      // Generate a temporary random password that the user will never see
      const tempPassword = randomBytes(32).toString('hex');
      
      const { data: newAuthData, error: authError } = await serviceSupabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: full_name || null
        }
      });

      if (authError || !newAuthData.user) {
        console.error('Error creating user in auth:', authError);
        return errorResponse(authError?.message || 'Failed to create user', 'AUTH_ERROR', 500);
      }
      
      authData = newAuthData;
    }

    // Create or update profile with additional fields
    const profileData = {
      id: authData.user.id,
      email: authData.user.email,
      full_name: full_name || null,
      phone: phone || null,
      account_type: account_type || 'customer',
      role: role || 'customer',
      organization_id: organization_id || null
    };

    const { data: updatedProfile, error: profileError } = await serviceSupabase
      .from('profiles')
      .upsert(profileData, { onConflict: 'id' })
      .select()
      .single();

    if (profileError) {
      console.error('Error updating profile:', profileError);
      // User was created in auth but profile update failed
      // Consider whether to delete the auth user or just return the error
      return errorResponse(profileError.message, 'DATABASE_ERROR', 500);
    }

    // Send password reset email to the user (for new users or existing users without profiles)
    try {
      const { error: resetError } = await serviceSupabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`
      });
      
      if (resetError) {
        console.error('Error sending password reset email:', resetError);
        // Don't fail the user creation if email fails, just log it
      }
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      // Continue anyway - admin can resend later
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
