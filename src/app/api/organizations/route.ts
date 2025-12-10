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

    // Insert organization
    const { data: organization, error } = await serviceSupabase
      .from('organizations')
      .insert({
        name,
        super_customer_id: user.id,
        contact_email: contact_email || null,
        contact_phone: contact_phone || null,
        address: address || null,
        city: city || null,
        state: state || null,
        zip_code: zip_code || null,
        country: 'India',
        gstin: gstin || null,
        pan: pan || null,
        notes: notes || null,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating organization:', error);
      return errorResponse(error.message, 'DATABASE_ERROR', 500);
    }

    return successResponse(organization);
  } catch (error: any) {
    console.error('Error in organizations API:', error);
    return errorResponse(error.message || 'Internal server error', 'INTERNAL_ERROR', 500);
  }
}

export async function GET(request: NextRequest) {
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

    const { data: organizations, error } = await serviceSupabase
      .from('organizations')
      .select(`
        *,
        profiles:super_customer_id (
          id,
          full_name,
          email
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching organizations:', error);
      return errorResponse(error.message, 'DATABASE_ERROR', 500);
    }

    return successResponse(organizations || []);
  } catch (error: any) {
    console.error('Error in organizations API:', error);
    return errorResponse(error.message || 'Internal server error', 'INTERNAL_ERROR', 500);
  }
}
