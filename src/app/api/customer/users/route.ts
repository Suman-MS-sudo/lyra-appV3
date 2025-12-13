import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, full_name, phone, organization_id, role, account_type, machine_ids } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Use service role to create user
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Generate a random temporary password
    const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);

    // Create auth user with temporary password
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name,
        phone
      }
    });

    if (authError) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    // Wait a moment for trigger to create profile
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Upsert profile with additional fields (insert or update)
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: authData.user.id,
        email: email,
        full_name: full_name || null,
        phone: phone || null,
        role: role || 'customer',
        account_type: account_type || 'customer',
        organization_id: organization_id || null
      }, {
        onConflict: 'id'
      });

    if (profileError) {
      console.error('Profile error:', profileError);
      // Try to delete the auth user if profile update fails
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: `Failed to create user profile: ${profileError.message}` },
        { status: 500 }
      );
    }

    // Assign machines to the new user if provided
    if (machine_ids && Array.isArray(machine_ids) && machine_ids.length > 0) {
      const { error: machineError } = await supabase
        .from('vending_machines')
        .update({ customer_id: authData.user.id })
        .in('id', machine_ids);

      if (machineError) {
        console.error('Machine assignment error:', machineError);
        // Don't fail - user is created, machines can be assigned later
      }
    }

    // Send password reset email to user with proper redirect
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:443';
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/auth/callback?next=/reset-password`
    });

    if (resetError) {
      console.error('Password reset email error:', resetError);
      // Don't fail the request, just log the error
      // User can still request password reset manually
    }

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email
      },
      message: 'User created successfully. Password setup link sent to email.'
    });

  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
