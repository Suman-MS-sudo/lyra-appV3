import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const body = await request.json();
    const { machine_ids, super_customer_id } = body;

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

    // Use service role for operations
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

    // Verify current user is a super customer
    const { data: currentProfile } = await serviceSupabase
      .from('profiles')
      .select('account_type, organization_id')
      .eq('id', user.id)
      .single();

    if (currentProfile?.account_type !== 'super_customer') {
      return NextResponse.json(
        { error: 'Only super customers can assign machines' },
        { status: 403 }
      );
    }

    // Verify target user belongs to same organization
    const { data: targetProfile } = await serviceSupabase
      .from('profiles')
      .select('organization_id')
      .eq('id', userId)
      .single();

    if (!targetProfile || targetProfile.organization_id !== currentProfile.organization_id) {
      return NextResponse.json(
        { error: 'User not found in your organization' },
        { status: 404 }
      );
    }

    // Step 1: Return all machines currently assigned to this user back to super customer
    const { error: returnError } = await serviceSupabase
      .from('vending_machines')
      .update({ customer_id: user.id })
      .eq('customer_id', userId);

    if (returnError) {
      console.error('Error returning machines:', returnError);
      return NextResponse.json(
        { error: `Failed to return machines: ${returnError.message}` },
        { status: 500 }
      );
    }

    // Step 2: Assign selected machines to the user
    if (machine_ids && Array.isArray(machine_ids) && machine_ids.length > 0) {
      const { error: assignError } = await serviceSupabase
        .from('vending_machines')
        .update({ customer_id: userId })
        .in('id', machine_ids)
        .eq('customer_id', user.id); // Only assign machines owned by super customer

      if (assignError) {
        console.error('Error assigning machines:', assignError);
        return NextResponse.json(
          { error: `Failed to assign machines: ${assignError.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Machine assignments updated successfully',
      assigned_count: machine_ids?.length || 0
    });

  } catch (error: any) {
    console.error('Error updating machine assignments:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
