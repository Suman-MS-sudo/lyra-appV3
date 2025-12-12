import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * Update Machine API
 * 
 * Endpoint: PUT /api/machines/update
 * Body: { machineId, name, machine_id, mac_id, location, status, machine_type, product_type, customer_id }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      machineId,
      name,
      machine_id,
      mac_id,
      location,
      status,
      machine_type,
      product_type,
      customer_id
    } = body;

    if (!machineId) {
      return errorResponse('Machine ID is required', 'MISSING_ID', 400);
    }

    // Validate MAC address format
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (mac_id && !macRegex.test(mac_id)) {
      return errorResponse('Invalid MAC address format. Use XX:XX:XX:XX:XX:XX', 'INVALID_MAC', 400);
    }

    // Use service role to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if machine_id or mac_id already exists (excluding current machine)
    if (machine_id) {
      const { data: existing } = await supabase
        .from('vending_machines')
        .select('id')
        .eq('machine_id', machine_id)
        .neq('id', machineId)
        .single();

      if (existing) {
        return errorResponse('Machine ID already exists', 'DUPLICATE_MACHINE_ID', 400);
      }
    }

    if (mac_id) {
      const { data: existingMac } = await supabase
        .from('vending_machines')
        .select('id')
        .eq('mac_id', mac_id)
        .neq('id', machineId)
        .single();

      if (existingMac) {
        return errorResponse('MAC address already exists', 'DUPLICATE_MAC', 400);
      }
    }

    // Update machine
    const updateData: any = {
      name,
      machine_id,
      mac_id,
      location,
      status,
      machine_type,
      product_type,
    };

    // Only update customer_id if provided (empty string means unassign)
    if (customer_id !== undefined) {
      updateData.customer_id = customer_id || null;
    }

    const { error: updateError } = await supabase
      .from('vending_machines')
      .update(updateData)
      .eq('id', machineId);

    if (updateError) {
      console.error('Update machine error:', updateError);
      return errorResponse('Failed to update machine', 'UPDATE_FAILED', 500);
    }

    console.log(`✅ Machine updated: ${machineId} (${name})`);

    return successResponse({
      message: 'Machine updated successfully',
    });

  } catch (error: any) {
    console.error('Update machine error:', error);
    return errorResponse(error.message || 'Internal server error', 'INTERNAL_ERROR', 500);
  }
}
