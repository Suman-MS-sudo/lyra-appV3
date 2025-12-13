import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get current user
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Use service role to verify permissions and delete
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get current user's profile
    const { data: currentProfile } = await serviceSupabase
      .from('profiles')
      .select('account_type, organization_id')
      .eq('id', user.id)
      .single();

    // Only super customers can delete users
    if (currentProfile?.account_type !== 'super_customer') {
      return NextResponse.json(
        { error: 'Only super customers can delete users' },
        { status: 403 }
      );
    }

    // Get user to be deleted
    const { data: userToDelete } = await serviceSupabase
      .from('profiles')
      .select('organization_id, email')
      .eq('id', userId)
      .single();

    if (!userToDelete) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Verify user belongs to same organization
    if (userToDelete.organization_id !== currentProfile.organization_id) {
      return NextResponse.json(
        { error: 'You can only delete users in your organization' },
        { status: 403 }
      );
    }

    // Return user's machines to super customer before deletion
    const { error: machineError } = await serviceSupabase
      .from('vending_machines')
      .update({ customer_id: user.id })
      .eq('customer_id', userId);

    if (machineError) {
      console.error('Error returning machines:', machineError);
      // Don't fail - continue with deletion
    }

    // Delete the auth user (this will cascade to profile via trigger)
    const { error: deleteError } = await serviceSupabase.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('Delete user error:', deleteError);
      return NextResponse.json(
        { error: `Failed to delete user: ${deleteError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
