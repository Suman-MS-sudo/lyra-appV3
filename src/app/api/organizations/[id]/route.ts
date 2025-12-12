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
      name,
      contact_email,
      contact_phone,
      address,
      city,
      state,
      zip_code,
      gstin,
      pan,
      notes
    } = body;

    if (!name) {
      return errorResponse('Organization name is required', 'VALIDATION_ERROR', 400);
    }

    // Update organization
    const { data: organization, error } = await serviceSupabase
      .from('organizations')
      .update({
        name,
        contact_email: contact_email || null,
        contact_phone: contact_phone || null,
        address: address || null,
        city: city || null,
        state: state || null,
        zip_code: zip_code || null,
        gstin: gstin || null,
        pan: pan || null,
        notes: notes || null
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating organization:', error);
      return errorResponse(error.message, 'DATABASE_ERROR', 500);
    }

    return successResponse(organization);
  } catch (error: any) {
    console.error('Error in organization update API:', error);
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

    // Check if organization has any machines
    const { data: machines } = await serviceSupabase
      .from('vending_machines')
      .select('id')
      .eq('organization_id', id)
      .limit(1);

    if (machines && machines.length > 0) {
      return errorResponse(
        'Cannot delete organization with associated machines',
        'VALIDATION_ERROR',
        400
      );
    }

    // Delete organization
    const { error } = await serviceSupabase
      .from('organizations')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting organization:', error);
      return errorResponse(error.message, 'DATABASE_ERROR', 500);
    }

    return successResponse({ message: 'Organization deleted successfully' });
  } catch (error: any) {
    console.error('Error in organization delete API:', error);
    return errorResponse(error.message || 'Internal server error', 'INTERNAL_ERROR', 500);
  }
}
