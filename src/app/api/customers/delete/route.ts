import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify user is a super customer
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('account_type')
      .eq('id', user.id)
      .single();

    if (profile?.account_type !== 'super_customer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const formData = await request.formData();
    const customerId = formData.get('id') as string;

    // Verify the customer belongs to this super customer's organization
    const { data: customerProfile } = await serviceSupabase
      .from('profiles')
      .select('organization_id, account_type')
      .eq('id', customerId)
      .single();

    if (!customerProfile || customerProfile.organization_id !== user.id) {
      return NextResponse.json({ error: 'Customer not found in your organization' }, { status: 404 });
    }

    // Prevent deletion of super customers or admins
    if (customerProfile.account_type === 'super_customer' || customerProfile.account_type === 'admin') {
      return NextResponse.json({ error: 'Cannot delete super customers or admins' }, { status: 403 });
    }

    // Delete the user from Supabase Auth (this will cascade to profiles)
    const { error: deleteError } = await serviceSupabase.auth.admin.deleteUser(customerId);

    if (deleteError) {
      throw new Error(`Failed to delete user: ${deleteError.message}`);
    }

    return NextResponse.redirect(new URL('/customer/dashboard#customers', request.url));
  } catch (error: any) {
    console.error('Error deleting customer:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete customer' },
      { status: 500 }
    );
  }
}
